-- P0 — Privilege Provenance Hardening
--
-- Elevated authority is no longer inheritable from citizens.role or from the
-- historical legacy_role / legacy_backfill sources. Active elevated grants are
-- accepted only when they were created by the canonical CTG One root bootstrap
-- or by an already-authorized VERTICE superadmin through the control plane.

-- 1. Quarantine historical elevated authority. The citizen baseline remains
-- intact; legitimate operators can be re-granted explicitly by a superadmin.
UPDATE citizen_role_grants
SET revoked_at = NOW()
WHERE revoked_at IS NULL
  AND role IN ('moderator', 'admin', 'superadmin')
  AND source IN ('legacy_role', 'legacy_backfill');

-- 2. Fail closed if production contains an elevated provenance we do not know
-- how to justify. This avoids silently blessing manual/system drift.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
      AND role IN ('moderator', 'admin', 'superadmin')
      AND source NOT IN ('ctg_one_bootstrap', 'superadmin_dashboard')
  ) THEN
    RAISE EXCEPTION 'UNTRUSTED_PRIVILEGED_GRANT_PROVENANCE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;
END;
$$;

-- 3. Any session whose selected role lost provenance is immediately reduced to
-- citizen. Refresh and live-role middleware then continue from explicit grants.
UPDATE sessions s
SET active_role = 'citizen'
WHERE s.active_role IN ('moderator', 'admin', 'superadmin')
  AND NOT EXISTS (
    SELECT 1
    FROM citizen_role_grants g
    WHERE g.citizen_id = s.citizen_id
      AND g.role = s.active_role
      AND g.revoked_at IS NULL
      AND g.source IN ('ctg_one_bootstrap', 'superadmin_dashboard')
  );

-- 4. citizens.role is retained only as a backwards-compatible projection. It
-- is recalculated from live grants so stale historical values cannot survive
-- the provenance cleanup.
WITH effective_roles AS (
  SELECT
    c.id,
    COALESCE(
      (
        SELECT g.role
        FROM citizen_role_grants g
        WHERE g.citizen_id = c.id
          AND g.revoked_at IS NULL
        ORDER BY CASE g.role
          WHEN 'superadmin' THEN 4
          WHEN 'admin' THEN 3
          WHEN 'moderator' THEN 2
          ELSE 1
        END DESC
        LIMIT 1
      ),
      'citizen'
    ) AS role
  FROM citizens c
)
UPDATE citizens c
SET role = e.role
FROM effective_roles e
WHERE e.id = c.id
  AND c.role IS DISTINCT FROM e.role;

CREATE OR REPLACE FUNCTION enforce_privileged_grant_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_root BOOLEAN;
  authorized_grantor BOOLEAN;
BEGIN
  -- Citizen is the unprivileged baseline and may come from account/session
  -- provisioning sources. Revoked rows are historical evidence only.
  IF NEW.revoked_at IS NOT NULL OR NEW.role = 'citizen' THEN
    RETURN NEW;
  END IF;

  IF NEW.source NOT IN ('ctg_one_bootstrap', 'superadmin_dashboard') THEN
    RAISE EXCEPTION 'UNTRUSTED_PRIVILEGED_GRANT_PROVENANCE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  IF NEW.source = 'ctg_one_bootstrap' THEN
    -- All elevated bootstrap grants, including moderator, are tied to the same
    -- canonical root identity pinned by P0 Root Authority Pinning.
    SELECT EXISTS (
      SELECT 1
      FROM citizens c
      INNER JOIN external_identities ei
        ON ei.citizen_id = c.id
       AND ei.provider = 'ctg_one'
      WHERE c.id = NEW.citizen_id
        AND LOWER(c.email) = 'valderramapino@gmail.com'
        AND LOWER(ei.email_at_link) = 'valderramapino@gmail.com'
        AND ENCODE(DIGEST(ei.provider_subject, 'sha256'), 'hex') =
            '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08'
    ) INTO canonical_root;

    IF canonical_root IS NOT TRUE OR NEW.granted_by_citizen_id IS NOT NULL THEN
      RAISE EXCEPTION 'INVALID_BOOTSTRAP_PRIVILEGE_PROVENANCE'
        USING ERRCODE = '23514',
              CONSTRAINT = 'citizen_role_grants_privilege_provenance';
    END IF;

    RETURN NEW;
  END IF;

  -- Dashboard grants must name a grantor that currently holds an explicitly
  -- trusted live superadmin grant. A historical/stale role field is irrelevant.
  IF NEW.granted_by_citizen_id IS NULL THEN
    RAISE EXCEPTION 'PRIVILEGED_GRANTOR_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM citizen_role_grants grantor
    WHERE grantor.citizen_id = NEW.granted_by_citizen_id
      AND grantor.role = 'superadmin'
      AND grantor.revoked_at IS NULL
      AND grantor.source IN ('ctg_one_bootstrap', 'superadmin_dashboard')
  ) INTO authorized_grantor;

  IF authorized_grantor IS NOT TRUE THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PRIVILEGED_GRANTOR'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS citizen_role_grants_privilege_provenance
  ON citizen_role_grants;

CREATE TRIGGER citizen_role_grants_privilege_provenance
BEFORE INSERT OR UPDATE ON citizen_role_grants
FOR EACH ROW
EXECUTE FUNCTION enforce_privileged_grant_provenance();

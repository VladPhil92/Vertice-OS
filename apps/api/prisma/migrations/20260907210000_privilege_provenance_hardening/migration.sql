-- P0 — Privilege Provenance Hardening
--
-- Elevated authority is no longer inheritable from citizens.role or from the
-- historical legacy_role / legacy_backfill sources. Active elevated grants are
-- accepted only when they descend from the canonical CTG One root bootstrap.
--
-- IMPORTANT: VÉRTICE already protects the final active superadmin at the DB
-- boundary. Therefore provenance migration must establish the canonical root
-- first and only then quarantine legacy authority. This preserves continuity
-- without disabling the LAST_SUPERADMIN_PROTECTED invariant.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Canonical root predicate shared by bootstrap validation and lineage checks.
CREATE OR REPLACE FUNCTION is_canonical_ctg_one_root(candidate UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM citizens c
    INNER JOIN external_identities ei
      ON ei.citizen_id = c.id
     AND ei.provider = 'ctg_one'
    WHERE c.id = candidate
      AND LOWER(c.email) = 'valderramapino@gmail.com'
      AND LOWER(ei.email_at_link) = 'valderramapino@gmail.com'
      AND ENCODE(DIGEST(ei.provider_subject, 'sha256'), 'hex') =
          '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08'
  );
$$;

-- 1. If legacy elevated authority exists, atomically hand authority to the
-- canonical root BEFORE removing any legacy superadmin. Clean installations
-- without historical privilege do not need a root account merely to migrate.
DO $$
DECLARE
  canonical_root_id UUID;
  legacy_elevated_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
      AND role IN ('moderator', 'admin', 'superadmin')
      AND source IN ('legacy_role', 'legacy_backfill')
  ) INTO legacy_elevated_exists;

  IF legacy_elevated_exists IS NOT TRUE THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vertice-superadmin-authority'));

  SELECT c.id
  INTO canonical_root_id
  FROM citizens c
  WHERE is_canonical_ctg_one_root(c.id)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF canonical_root_id IS NULL THEN
    RAISE EXCEPTION 'CANONICAL_ROOT_REQUIRED_FOR_PRIVILEGE_HANDOVER'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  INSERT INTO citizen_role_grants
    (citizen_id, role, granted_by_citizen_id, source, granted_at, revoked_at)
  SELECT
    canonical_root_id,
    elevated.role,
    NULL,
    'ctg_one_bootstrap',
    NOW(),
    NULL
  FROM unnest(ARRAY['moderator', 'admin', 'superadmin']::text[]) AS elevated(role)
  ON CONFLICT (citizen_id, role)
  DO UPDATE SET
    granted_by_citizen_id = NULL,
    source = 'ctg_one_bootstrap',
    granted_at = NOW(),
    revoked_at = NULL;
END;
$$;

-- 2. Quarantine historical elevated authority only after the canonical root is
-- live when a handover was required. The existing last-superadmin trigger stays
-- enabled throughout the migration.
UPDATE citizen_role_grants
SET revoked_at = NOW()
WHERE revoked_at IS NULL
  AND role IN ('moderator', 'admin', 'superadmin')
  AND source IN ('legacy_role', 'legacy_backfill');

-- A superadmin is trusted only if its live grant chain terminates at the
-- canonical CTG One root bootstrap. The path array breaks malformed cycles.
CREATE OR REPLACE FUNCTION has_trusted_superadmin_lineage(candidate UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE lineage AS (
    SELECT
      g.citizen_id,
      g.granted_by_citizen_id,
      g.source,
      ARRAY[g.citizen_id]::UUID[] AS path
    FROM citizen_role_grants g
    WHERE g.citizen_id = candidate
      AND g.role = 'superadmin'
      AND g.revoked_at IS NULL
      AND g.source IN ('ctg_one_bootstrap', 'superadmin_dashboard')

    UNION ALL

    SELECT
      parent.citizen_id,
      parent.granted_by_citizen_id,
      parent.source,
      child.path || parent.citizen_id
    FROM lineage child
    INNER JOIN citizen_role_grants parent
      ON parent.citizen_id = child.granted_by_citizen_id
     AND parent.role = 'superadmin'
     AND parent.revoked_at IS NULL
     AND parent.source IN ('ctg_one_bootstrap', 'superadmin_dashboard')
    WHERE NOT parent.citizen_id = ANY(child.path)
  )
  SELECT EXISTS (
    SELECT 1
    FROM lineage l
    WHERE l.source = 'ctg_one_bootstrap'
      AND l.granted_by_citizen_id IS NULL
      AND is_canonical_ctg_one_root(l.citizen_id)
  );
$$;

-- 3. Fail closed if production contains any elevated provenance that is either
-- unknown or cannot be proven back to the canonical root.
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

  IF EXISTS (
    SELECT 1
    FROM citizen_role_grants g
    WHERE g.revoked_at IS NULL
      AND g.role IN ('moderator', 'admin', 'superadmin')
      AND g.source = 'ctg_one_bootstrap'
      AND (
        g.granted_by_citizen_id IS NOT NULL
        OR NOT is_canonical_ctg_one_root(g.citizen_id)
      )
  ) THEN
    RAISE EXCEPTION 'INVALID_EXISTING_BOOTSTRAP_PRIVILEGE_PROVENANCE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM citizen_role_grants g
    WHERE g.revoked_at IS NULL
      AND g.role IN ('moderator', 'admin', 'superadmin')
      AND g.source = 'superadmin_dashboard'
      AND (
        g.granted_by_citizen_id IS NULL
        OR NOT has_trusted_superadmin_lineage(g.granted_by_citizen_id)
      )
  ) THEN
    RAISE EXCEPTION 'INVALID_EXISTING_DASHBOARD_PRIVILEGE_PROVENANCE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;
END;
$$;

-- 4. Any session whose selected role lost provenance is immediately reduced to
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
      AND (
        (g.source = 'ctg_one_bootstrap' AND is_canonical_ctg_one_root(g.citizen_id))
        OR (
          g.source = 'superadmin_dashboard'
          AND g.granted_by_citizen_id IS NOT NULL
          AND has_trusted_superadmin_lineage(g.granted_by_citizen_id)
        )
      )
  );

-- 5. citizens.role is retained only as a backwards-compatible projection. It
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
    IF NEW.granted_by_citizen_id IS NOT NULL
       OR NOT is_canonical_ctg_one_root(NEW.citizen_id) THEN
      RAISE EXCEPTION 'INVALID_BOOTSTRAP_PRIVILEGE_PROVENANCE'
        USING ERRCODE = '23514',
              CONSTRAINT = 'citizen_role_grants_privilege_provenance';
    END IF;

    RETURN NEW;
  END IF;

  -- Dashboard grants require a grantor whose current superadmin authority has a
  -- complete, acyclic lineage back to the canonical CTG One root.
  IF NEW.granted_by_citizen_id IS NULL THEN
    RAISE EXCEPTION 'PRIVILEGED_GRANTOR_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  IF NOT has_trusted_superadmin_lineage(NEW.granted_by_citizen_id) THEN
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

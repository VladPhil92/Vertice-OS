-- P0 — Canonical Root Grant Reconciliation
--
-- Finalize the post-provenance-handover state so the canonical CTG One root
-- owns exactly one elevated bootstrap grant: superadmin. Lower roles are
-- inherited by authorization policy and must not exist as redundant bootstrap
-- grants.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  canonical_root_id UUID;
  elevated_exists BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('vertice-superadmin-authority'));

  SELECT EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
      AND role IN ('admin', 'superadmin')
  ) INTO elevated_exists;

  -- A clean installation may legitimately have no root bootstrap yet.
  IF elevated_exists IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT c.id
  INTO canonical_root_id
  FROM citizens c
  WHERE is_canonical_ctg_one_root(c.id)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF canonical_root_id IS NULL THEN
    RAISE EXCEPTION 'CANONICAL_ROOT_REQUIRED_FOR_GRANT_RECONCILIATION'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_canonical_root_state';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE citizen_id = canonical_root_id
      AND role = 'superadmin'
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'CANONICAL_ROOT_SUPERADMIN_REQUIRED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_canonical_root_state';
  END IF;

  -- Change provenance in place. The last-superadmin trigger protects removals,
  -- not updates that keep the grant active, so authority is continuous.
  UPDATE citizen_role_grants
  SET source = 'ctg_one_bootstrap',
      granted_by_citizen_id = NULL,
      granted_at = NOW()
  WHERE citizen_id = canonical_root_id
    AND role = 'superadmin'
    AND revoked_at IS NULL;

  -- Remove redundant lower bootstrap grants from the root. Superadmin already
  -- satisfies admin/moderator authorization checks.
  UPDATE citizen_role_grants
  SET revoked_at = NOW()
  WHERE citizen_id = canonical_root_id
    AND role IN ('moderator', 'admin')
    AND revoked_at IS NULL;

  UPDATE sessions
  SET active_role = 'citizen'
  WHERE citizen_id = canonical_root_id
    AND revoked_at IS NULL
    AND active_role IN ('moderator', 'admin');

  UPDATE citizens
  SET role = 'superadmin'
  WHERE id = canonical_root_id
    AND role IS DISTINCT FROM 'superadmin';

  -- Initial production invariant: exactly one root superadmin and zero admins.
  IF EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'UNEXPECTED_ACTIVE_ADMIN_AFTER_ROOT_RECONCILIATION'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_canonical_root_state';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
      AND role = 'superadmin'
  ) <> 1
  OR NOT EXISTS (
    SELECT 1
    FROM citizen_role_grants
    WHERE citizen_id = canonical_root_id
      AND role = 'superadmin'
      AND revoked_at IS NULL
      AND source = 'ctg_one_bootstrap'
      AND granted_by_citizen_id IS NULL
  ) THEN
    RAISE EXCEPTION 'CANONICAL_ROOT_SUPERADMIN_STATE_MISMATCH'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_canonical_root_state';
  END IF;
END;
$$;

-- Tighten the provenance boundary: CTG One bootstrap may establish only the
-- root superadmin grant. Admin/moderator authority is delegated explicitly from
-- Control VÉRTICE and therefore must use superadmin_dashboard provenance.
CREATE OR REPLACE FUNCTION enforce_privileged_grant_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL OR NEW.role = 'citizen' THEN
    RETURN NEW;
  END IF;

  IF NEW.source NOT IN ('ctg_one_bootstrap', 'superadmin_dashboard') THEN
    RAISE EXCEPTION 'UNTRUSTED_PRIVILEGED_GRANT_PROVENANCE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_privilege_provenance';
  END IF;

  IF NEW.source = 'ctg_one_bootstrap' THEN
    IF NEW.role <> 'superadmin' THEN
      RAISE EXCEPTION 'ROOT_BOOTSTRAP_ROLE_NOT_ALLOWED'
        USING ERRCODE = '23514',
              CONSTRAINT = 'citizen_role_grants_canonical_root_state';
    END IF;

    IF NEW.granted_by_citizen_id IS NOT NULL
       OR NOT is_canonical_ctg_one_root(NEW.citizen_id) THEN
      RAISE EXCEPTION 'INVALID_BOOTSTRAP_PRIVILEGE_PROVENANCE'
        USING ERRCODE = '23514',
              CONSTRAINT = 'citizen_role_grants_privilege_provenance';
    END IF;

    RETURN NEW;
  END IF;

  -- The canonical root's bootstrap provenance is immutable through the generic
  -- role dashboard. This prevents a self-grant from replacing the trusted root
  -- with a circular superadmin_dashboard lineage.
  IF is_canonical_ctg_one_root(NEW.citizen_id) THEN
    RAISE EXCEPTION 'CANONICAL_ROOT_GRANT_IMMUTABLE'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_canonical_root_state';
  END IF;

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

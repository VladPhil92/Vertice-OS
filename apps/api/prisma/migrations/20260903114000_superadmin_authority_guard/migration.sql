-- Defense-in-depth for the root authority invariant.
-- Application code already serializes superadmin mutations with the same
-- advisory lock. This trigger protects the invariant even if a future code
-- path or manual SQL attempts to revoke/delete the final active superadmin.

CREATE OR REPLACE FUNCTION protect_last_superadmin_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  active_superadmins BIGINT;
BEGIN
  IF OLD.role <> 'superadmin' OR OLD.revoked_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Updates that keep the grant active are not removals.
  IF TG_OP = 'UPDATE' AND NEW.revoked_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize with application-level grant mutations and with other trigger
  -- executions so concurrent demotions cannot both observe a stale count.
  PERFORM pg_advisory_xact_lock(hashtext('vertice-superadmin-authority'));

  SELECT COUNT(*)
  INTO active_superadmins
  FROM citizen_role_grants
  WHERE role = 'superadmin'
    AND revoked_at IS NULL;

  IF active_superadmins <= 1 THEN
    RAISE EXCEPTION 'LAST_SUPERADMIN_PROTECTED'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_last_superadmin_guard';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS citizen_role_grants_protect_last_superadmin
  ON citizen_role_grants;

CREATE TRIGGER citizen_role_grants_protect_last_superadmin
BEFORE UPDATE OF revoked_at OR DELETE ON citizen_role_grants
FOR EACH ROW
EXECUTE FUNCTION protect_last_superadmin_grant();
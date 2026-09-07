-- P0 — Root Authority Pinning
--
-- The first CTG One bootstrap may elevate exactly one canonical identity.
-- Email is pinned explicitly; the immutable CTG One subject is pinned by
-- SHA-256 so its raw auth.users UUID is not published in this repository.
--
-- This is enforced at the database boundary so a future application path,
-- manual ORM mutation, or stale service code cannot bootstrap admin/superadmin
-- authority for a different federated identity.

-- pgcrypto is already part of the VÉRTICE database extension baseline. Keep the
-- migration self-contained so the SHA-256 pin is available on every target.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION enforce_root_superadmin_bootstrap_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_identity BOOLEAN;
BEGIN
  -- Only CTG One's one-time root bootstrap is subject to this invariant.
  -- Ongoing role administration remains governed by the Superadmin dashboard
  -- and the existing live-role authorization boundary.
  IF NEW.revoked_at IS NOT NULL
     OR NEW.source <> 'ctg_one_bootstrap'
     OR NEW.role NOT IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM citizens c
    INNER JOIN external_identities ei
      ON ei.citizen_id = c.id
     AND ei.provider = 'ctg_one'
    WHERE c.id = NEW.citizen_id
      AND LOWER(c.email) = 'valderramapino@gmail.com'
      AND ENCODE(DIGEST(ei.provider_subject, 'sha256'), 'hex') =
          '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08'
  ) INTO canonical_identity;

  IF canonical_identity IS NOT TRUE THEN
    RAISE EXCEPTION 'ROOT_SUPERADMIN_IDENTITY_MISMATCH'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_root_authority_pin';
  END IF;

  RETURN NEW;
END;
$$;

-- Refuse to install the guard over an already-invalid bootstrap state. This
-- turns a drifted production database into an explicit deployment failure
-- instead of silently blessing the wrong root identity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM citizen_role_grants g
    INNER JOIN citizens c ON c.id = g.citizen_id
    WHERE g.revoked_at IS NULL
      AND g.source = 'ctg_one_bootstrap'
      AND g.role IN ('admin', 'superadmin')
      AND (
        LOWER(c.email) IS DISTINCT FROM 'valderramapino@gmail.com'
        OR NOT EXISTS (
          SELECT 1
          FROM external_identities ei
          WHERE ei.citizen_id = c.id
            AND ei.provider = 'ctg_one'
            AND ENCODE(DIGEST(ei.provider_subject, 'sha256'), 'hex') =
                '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08'
        )
      )
  ) THEN
    RAISE EXCEPTION 'ROOT_SUPERADMIN_EXISTING_IDENTITY_MISMATCH'
      USING ERRCODE = '23514',
            CONSTRAINT = 'citizen_role_grants_root_authority_pin';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS citizen_role_grants_root_authority_pin
  ON citizen_role_grants;

CREATE TRIGGER citizen_role_grants_root_authority_pin
BEFORE INSERT OR UPDATE ON citizen_role_grants
FOR EACH ROW
EXECUTE FUNCTION enforce_root_superadmin_bootstrap_pin();

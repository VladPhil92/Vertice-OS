-- P1 — Least-Privilege Session Activation
--
-- Durable role assignment and session activation are separate decisions.
-- Existing elevated sessions are normalized to citizen at cutover, and future
-- sessions are required to be created at the unprivileged citizen baseline.

-- 1. Immediate cutover: already-issued privileged sessions lose their active
-- role. Privileged middleware binds JWT role to sessions.active_role, so stale
-- elevated tokens fail closed immediately and the user must explicitly switch
-- roles again from a live session.
UPDATE sessions
SET active_role = 'citizen'
WHERE revoked_at IS NULL
  AND active_role IN ('moderator', 'admin', 'superadmin');

-- 2. Defense in depth: no future application path may INSERT a session already
-- elevated. Explicit role activation remains an UPDATE performed only by the
-- audited role-switch boundary after a live grant check.
CREATE OR REPLACE FUNCTION enforce_session_citizen_baseline_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.active_role IS DISTINCT FROM 'citizen' THEN
    RAISE EXCEPTION 'SESSION_MUST_START_AS_CITIZEN'
      USING ERRCODE = '23514',
            CONSTRAINT = 'sessions_least_privilege_insert';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_least_privilege_insert ON sessions;

CREATE TRIGGER sessions_least_privilege_insert
BEFORE INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION enforce_session_citizen_baseline_on_insert();

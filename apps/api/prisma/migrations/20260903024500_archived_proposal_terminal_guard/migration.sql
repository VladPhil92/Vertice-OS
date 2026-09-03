-- Governance Security Consolidation P1
--
-- `archived` is a terminal moderation state. A stale lifecycle request that
-- read `draft`/`debate` before a moderator archived the proposal must never be
-- able to resurrect that row into a civic voting lifecycle afterwards.
--
-- This guard lives in PostgreSQL so every code path (current, legacy, admin,
-- raw SQL) shares the same invariant. If a stale debate->voting transaction has
-- already inserted voter-roll rows, rejecting the status UPDATE aborts that
-- transaction and rolls the roll snapshot back with it.
CREATE OR REPLACE FUNCTION protect_archived_proposal_terminal_state()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'archived' AND NEW.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'archived proposals cannot re-enter the civic lifecycle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_protect_archived_proposal_terminal_state" ON "proposals";
CREATE TRIGGER "trg_protect_archived_proposal_terminal_state"
BEFORE UPDATE OF "status" ON "proposals"
FOR EACH ROW
EXECUTE FUNCTION protect_archived_proposal_terminal_state();

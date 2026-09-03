-- Governance Integrity Phase III follow-up: voter-roll membership identity guard.
--
-- A voter-roll row is an auditable membership fact. Moving its composite-key
-- identity to another proposal/citizen is never a legitimate mutation: before
-- voting it should be deleted/reinserted by the roll builder, and after voting
-- the complete snapshot is immutable. Rejecting key rewrites unconditionally
-- also prevents moving a row from an unopened proposal into an already-frozen
-- electorate.
CREATE OR REPLACE FUNCTION protect_frozen_voter_roll()
RETURNS TRIGGER AS $$
DECLARE
  target_proposal_id UUID;
  vote_opened_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
    OR NEW.citizen_id IS DISTINCT FROM OLD.citizen_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'voter-roll proposal and citizen identity are immutable';
  END IF;

  IF TG_OP = 'INSERT' THEN
    target_proposal_id := NEW.proposal_id;
  ELSE
    target_proposal_id := OLD.proposal_id;
  END IF;

  SELECT voting_starts_at
    INTO vote_opened_at
    FROM proposals
   WHERE id = target_proposal_id;

  IF vote_opened_at IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'voter roll is immutable after voting opens';
    END IF;

    IF NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.locality_id IS DISTINCT FROM OLD.locality_id
       OR NEW.verification_level IS DISTINCT FROM OLD.verification_level
       OR NEW.eligibility_reason IS DISTINCT FROM OLD.eligibility_reason
       OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at
       OR NEW.effective_delegate_id IS DISTINCT FROM OLD.effective_delegate_id
       OR NEW.source_delegation_id IS DISTINCT FROM OLD.source_delegation_id
       OR NEW.effective_delegation_type IS DISTINCT FROM OLD.effective_delegation_type
       OR NEW.delegation_frozen_at IS DISTINCT FROM OLD.delegation_frozen_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'voter roll is immutable after voting opens';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Governance Integrity Phase III: freeze the effective liquid-democracy mapping
-- at the same boundary as the voter roll. The voter roll remains the canonical
-- electorate snapshot; these nullable columns record how each eligible citizen
-- had delegated at the instant the proposal entered `voting`.
ALTER TABLE "proposal_voter_roll"
  ADD COLUMN "effective_delegate_id" UUID,
  ADD COLUMN "source_delegation_id" UUID,
  ADD COLUMN "effective_delegation_type" VARCHAR(20),
  ADD COLUMN "delegation_frozen_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_proposal_voter_roll_effective_delegate"
  ON "proposal_voter_roll" ("proposal_id", "effective_delegate_id")
  WHERE "effective_delegate_id" IS NOT NULL;

-- Legacy cutover safety. The former administrative force-advance path could
-- create `voting` rows without the same voter-roll/window/threshold contract as
-- the canonical debate -> voting transition. Such a consultation cannot be
-- retroactively certified without inventing facts. Archive it before installing
-- the new guards; only verifiably consistent active votes continue through the
-- cutover below.
WITH roll_counts AS (
  SELECT p.id, COUNT(pvr.citizen_id)::INTEGER AS roll_count
  FROM proposals p
  LEFT JOIN proposal_voter_roll pvr ON pvr.proposal_id = p.id
  WHERE p.status = 'voting'
  GROUP BY p.id
),
invalid_voting AS (
  SELECT p.id
  FROM proposals p
  INNER JOIN roll_counts r ON r.id = p.id
  WHERE p.status = 'voting'
    AND (
      p.voting_starts_at IS NULL
      OR p.voting_ends_at IS NULL
      OR p.voting_ends_at <= p.voting_starts_at
      OR p.quorum_required IS NULL
      OR p.quorum_required < 0
      OR p.quorum_required > 1
      OR p.approval_threshold IS NULL
      OR p.approval_threshold < 0
      OR p.approval_threshold > 1
      OR p.eligible_voters IS NULL
      OR p.eligible_voters <> r.roll_count
    )
)
UPDATE proposals p
SET status = 'archived', updated_at = NOW()
FROM invalid_voting invalid
WHERE p.id = invalid.id;

-- Cutover for proposals that are already voting when this migration lands.
-- We snapshot their current effective delegation at migration time rather than
-- fabricating a historical opening-time mapping that can no longer be proven.
UPDATE proposal_voter_roll pvr
   SET delegation_frozen_at = NOW()
  FROM proposals p
 WHERE p.id = pvr.proposal_id
   AND p.status = 'voting'
   AND pvr.delegation_frozen_at IS NULL;

WITH active_voting AS (
  SELECT id, category
  FROM proposals
  WHERE status = 'voting'
),
effective_delegations AS (
  SELECT DISTINCT ON (p.id, d.delegator_id)
    p.id AS proposal_id,
    d.delegator_id,
    d.delegate_id,
    d.id AS source_delegation_id,
    d.delegation_type
  FROM active_voting p
  INNER JOIN proposal_voter_roll delegator_roll
    ON delegator_roll.proposal_id = p.id
  INNER JOIN delegations d
    ON d.delegator_id = delegator_roll.citizen_id
  INNER JOIN proposal_voter_roll delegate_roll
    ON delegate_roll.proposal_id = p.id
   AND delegate_roll.citizen_id = d.delegate_id
  WHERE d.is_active = TRUE
    AND d.delegator_id <> d.delegate_id
    AND d.valid_from <= NOW()
    AND (d.valid_until IS NULL OR d.valid_until > NOW())
    AND (
      d.delegation_type = 'general'
      OR (d.delegation_type = 'domain' AND d.domain = p.category)
      OR (d.delegation_type = 'proposal' AND d.proposal_id = p.id)
    )
  ORDER BY
    p.id,
    d.delegator_id,
    CASE d.delegation_type
      WHEN 'proposal' THEN 3
      WHEN 'domain' THEN 2
      ELSE 1
    END DESC,
    d.created_at DESC,
    d.id DESC
)
UPDATE proposal_voter_roll pvr
   SET effective_delegate_id = ed.delegate_id,
       source_delegation_id = ed.source_delegation_id,
       effective_delegation_type = ed.delegation_type
  FROM effective_delegations ed
 WHERE pvr.proposal_id = ed.proposal_id
   AND pvr.citizen_id = ed.delegator_id;

-- Every transition into `voting` must arrive with the complete canonical
-- election contract already computed by the application transaction. The DB
-- independently validates that contract so direct SQL/admin code cannot create
-- an under-specified voting window.
CREATE OR REPLACE FUNCTION freeze_governance_electorate_transition()
RETURNS TRIGGER AS $$
DECLARE
  roll_count INTEGER;
BEGIN
  IF NEW.status = 'voting' AND OLD.status IS DISTINCT FROM 'voting' THEN
    IF NEW.eligible_voters IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'cannot enter voting without a frozen voter-roll denominator';
    END IF;

    IF NEW.voting_starts_at IS NULL
       OR NEW.voting_ends_at IS NULL
       OR NEW.voting_ends_at <= NEW.voting_starts_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'cannot enter voting without a valid voting window';
    END IF;

    IF NEW.quorum_required IS NULL
       OR NEW.approval_threshold IS NULL
       OR NEW.quorum_required < 0
       OR NEW.quorum_required > 1
       OR NEW.approval_threshold < 0
       OR NEW.approval_threshold > 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'cannot enter voting without valid quorum and approval thresholds';
    END IF;

    SELECT COUNT(*)::INTEGER
      INTO roll_count
      FROM proposal_voter_roll
     WHERE proposal_id = NEW.id;

    IF roll_count <> NEW.eligible_voters THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format(
          'voter-roll mismatch for proposal %s: roll=%s eligible_voters=%s',
          NEW.id,
          roll_count,
          NEW.eligible_voters
        );
    END IF;

    -- Mark every row as having reached the delegation snapshot boundary,
    -- including citizens without an active delegation.
    UPDATE proposal_voter_roll
       SET effective_delegate_id = NULL,
           source_delegation_id = NULL,
           effective_delegation_type = NULL,
           delegation_frozen_at = NOW()
     WHERE proposal_id = NEW.id;

    WITH effective_delegations AS (
      SELECT DISTINCT ON (d.delegator_id)
        d.delegator_id,
        d.delegate_id,
        d.id AS source_delegation_id,
        d.delegation_type
      FROM delegations d
      INNER JOIN proposal_voter_roll delegator_roll
        ON delegator_roll.proposal_id = NEW.id
       AND delegator_roll.citizen_id = d.delegator_id
      INNER JOIN proposal_voter_roll delegate_roll
        ON delegate_roll.proposal_id = NEW.id
       AND delegate_roll.citizen_id = d.delegate_id
      WHERE d.is_active = TRUE
        AND d.delegator_id <> d.delegate_id
        AND d.valid_from <= NOW()
        AND (d.valid_until IS NULL OR d.valid_until > NOW())
        AND (
          d.delegation_type = 'general'
          OR (d.delegation_type = 'domain' AND d.domain = NEW.category)
          OR (d.delegation_type = 'proposal' AND d.proposal_id = NEW.id)
        )
      ORDER BY
        d.delegator_id,
        CASE d.delegation_type
          WHEN 'proposal' THEN 3
          WHEN 'domain' THEN 2
          ELSE 1
        END DESC,
        d.created_at DESC,
        d.id DESC
    )
    UPDATE proposal_voter_roll pvr
       SET effective_delegate_id = ed.delegate_id,
           source_delegation_id = ed.source_delegation_id,
           effective_delegation_type = ed.delegation_type
      FROM effective_delegations ed
     WHERE pvr.proposal_id = NEW.id
       AND pvr.citizen_id = ed.delegator_id;
  END IF;

  -- Once a voting window opens, no application/admin path may resolve the
  -- proposal before the configured end time. Normal finalization remains
  -- available after voting_ends_at and computes the result from the ledger.
  IF OLD.status = 'voting'
     AND NEW.status IS DISTINCT FROM 'voting'
     AND (OLD.voting_ends_at IS NULL OR NOW() < OLD.voting_ends_at) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'cannot leave voting before voting_ends_at';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_freeze_governance_electorate_transition" ON "proposals";
CREATE TRIGGER "trg_freeze_governance_electorate_transition"
BEFORE UPDATE OF "status" ON "proposals"
FOR EACH ROW
EXECUTE FUNCTION freeze_governance_electorate_transition();

-- After a vote has opened, its electorate-defining parameters are immutable.
-- A later code/config change therefore cannot silently rewrite the rules of an
-- in-progress or historical consultation.
CREATE OR REPLACE FUNCTION protect_frozen_election_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.voting_starts_at IS NOT NULL AND (
    NEW.author_id IS DISTINCT FROM OLD.author_id
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.scope IS DISTINCT FROM OLD.scope
    OR NEW.locality_id IS DISTINCT FROM OLD.locality_id
    OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
    OR NEW.voting_starts_at IS DISTINCT FROM OLD.voting_starts_at
    OR NEW.voting_ends_at IS DISTINCT FROM OLD.voting_ends_at
    OR NEW.quorum_required IS DISTINCT FROM OLD.quorum_required
    OR NEW.approval_threshold IS DISTINCT FROM OLD.approval_threshold
    OR NEW.eligible_voters IS DISTINCT FROM OLD.eligible_voters
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'election contract is immutable after voting opens';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_protect_frozen_election_contract" ON "proposals";
CREATE TRIGGER "trg_protect_frozen_election_contract"
BEFORE UPDATE OF
  "author_id", "category", "scope", "locality_id", "neighborhood",
  "voting_starts_at", "voting_ends_at", "quorum_required",
  "approval_threshold", "eligible_voters"
ON "proposals"
FOR EACH ROW
EXECUTE FUNCTION protect_frozen_election_contract();

-- Closing a vote must agree with the thresholds that were frozen on the
-- proposal when voting opened. This blocks legacy/admin SQL from forcing an
-- arbitrary terminal result after the deadline. The application currently
-- uses the same scope configuration to compute these values; if code and the
-- frozen contract ever diverge, finalization fails loudly rather than silently
-- recording a different civic decision.
CREATE OR REPLACE FUNCTION validate_frozen_voting_result()
RETURNS TRIGGER AS $$
DECLARE
  expected_status TEXT;
  participation_rate NUMERIC;
  total_weight NUMERIC;
  approval_rate NUMERIC;
BEGIN
  IF OLD.status = 'voting' AND NEW.status IS DISTINCT FROM 'voting' THEN
    IF OLD.voting_ends_at IS NULL OR NOW() < OLD.voting_ends_at THEN
      RETURN NEW; -- early exit is rejected by freeze_governance_electorate_transition
    END IF;

    IF OLD.eligible_voters IS NULL
       OR OLD.eligible_voters <= 0
       OR OLD.quorum_required IS NULL
       OR OLD.approval_threshold IS NULL THEN
      expected_status := 'quorum_failed';
    ELSE
      participation_rate := OLD.total_votes::NUMERIC / OLD.eligible_voters::NUMERIC;

      IF participation_rate < OLD.quorum_required THEN
        expected_status := 'quorum_failed';
      ELSE
        total_weight := OLD.approve_votes_weighted
                      + OLD.reject_votes_weighted
                      + OLD.abstain_votes_weighted;
        approval_rate := CASE
          WHEN total_weight > 0 THEN OLD.approve_votes_weighted / total_weight
          ELSE 0
        END;
        expected_status := CASE
          WHEN approval_rate >= OLD.approval_threshold THEN 'approved'
          ELSE 'rejected'
        END;
      END IF;
    END IF;

    IF NEW.status <> expected_status THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format(
          'voting result mismatch for proposal %s: expected=%s requested=%s',
          OLD.id,
          expected_status,
          NEW.status
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_validate_frozen_voting_result" ON "proposals";
CREATE TRIGGER "trg_validate_frozen_voting_result"
BEFORE UPDATE OF "status" ON "proposals"
FOR EACH ROW
EXECUTE FUNCTION validate_frozen_voting_result();

-- The entire voter-roll snapshot becomes immutable once a proposal has ever
-- opened voting. This covers membership, eligibility metadata and frozen
-- delegation data, and also blocks later INSERT/DELETE operations. Checking
-- voting_starts_at rather than today's status keeps the guarantee intact even
-- after the proposal is approved, rejected, archived or executed.
CREATE OR REPLACE FUNCTION protect_frozen_voter_roll()
RETURNS TRIGGER AS $$
DECLARE
  target_proposal_id UUID;
  vote_opened_at TIMESTAMPTZ;
BEGIN
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

    IF NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
       OR NEW.citizen_id IS DISTINCT FROM OLD.citizen_id
       OR NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
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

DROP TRIGGER IF EXISTS "trg_protect_frozen_voter_roll" ON "proposal_voter_roll";
CREATE TRIGGER "trg_protect_frozen_voter_roll"
BEFORE INSERT OR UPDATE OR DELETE ON "proposal_voter_roll"
FOR EACH ROW
EXECUTE FUNCTION protect_frozen_voter_roll();
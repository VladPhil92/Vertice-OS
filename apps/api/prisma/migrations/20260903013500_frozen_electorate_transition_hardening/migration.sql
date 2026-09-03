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

-- Every transition into `voting` must arrive with the canonical voter-roll
-- denominator already computed by the application transaction. This prevents
-- direct SQL/admin paths from opening a vote without a frozen electorate.
-- The same trigger resolves one effective delegation per delegator using the
-- precedence contract proposal > domain > general, newest wins within a tie.
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

-- After the proposal has entered voting, the frozen liquid-democracy mapping
-- is immutable. This preserves the audit trail even if users later revoke or
-- replace their live delegation for future proposals.
CREATE OR REPLACE FUNCTION protect_frozen_delegation_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  proposal_status TEXT;
BEGIN
  SELECT status INTO proposal_status FROM proposals WHERE id = OLD.proposal_id;

  IF proposal_status IN (
    'voting', 'approved', 'rejected', 'quorum_failed',
    'executed', 'failed_execution'
  ) AND (
    NEW.effective_delegate_id IS DISTINCT FROM OLD.effective_delegate_id
    OR NEW.source_delegation_id IS DISTINCT FROM OLD.source_delegation_id
    OR NEW.effective_delegation_type IS DISTINCT FROM OLD.effective_delegation_type
    OR NEW.delegation_frozen_at IS DISTINCT FROM OLD.delegation_frozen_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'delegation snapshot is immutable after voting opens';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_protect_frozen_delegation_snapshot" ON "proposal_voter_roll";
CREATE TRIGGER "trg_protect_frozen_delegation_snapshot"
BEFORE UPDATE ON "proposal_voter_roll"
FOR EACH ROW
EXECUTE FUNCTION protect_frozen_delegation_snapshot();
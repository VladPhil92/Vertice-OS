-- Phase VII: explicit, auditable crowdfunding campaign lifecycle.
-- This migration does not enable payment rails or payouts.

ALTER TABLE crowdfunding_campaigns
  ADD COLUMN IF NOT EXISTS revision_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_by_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL;

ALTER TABLE crowdfunding_campaigns
  DROP CONSTRAINT IF EXISTS crowdfunding_campaigns_revision_no_check;
ALTER TABLE crowdfunding_campaigns
  ADD CONSTRAINT crowdfunding_campaigns_revision_no_check CHECK (revision_no >= 1);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_review_queue
  ON crowdfunding_campaigns (status, compliance_status, submitted_for_review_at ASC)
  WHERE status = 'review';

CREATE TABLE IF NOT EXISTS crowdfunding_campaign_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(id) ON DELETE CASCADE,
  actor_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  revision_no INTEGER NOT NULL,
  from_status VARCHAR(24),
  to_status VARCHAR(24) NOT NULL,
  from_compliance_status VARCHAR(20),
  to_compliance_status VARCHAR(20) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crowdfunding_campaign_lifecycle_event_type_check CHECK (
    event_type IN (
      'draft_created', 'draft_updated', 'submitted_for_review',
      'changes_requested', 'rejected', 'approved', 'activated',
      'suspended'
    )
  ),
  CONSTRAINT crowdfunding_campaign_lifecycle_revision_check CHECK (revision_no >= 1)
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaign_lifecycle_events_campaign
  ON crowdfunding_campaign_lifecycle_events (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaign_lifecycle_events_actor
  ON crowdfunding_campaign_lifecycle_events (actor_citizen_id, created_at DESC)
  WHERE actor_citizen_id IS NOT NULL;

-- Backfill a creation event for campaigns that predate the lifecycle ledger.
INSERT INTO crowdfunding_campaign_lifecycle_events (
  campaign_id, actor_citizen_id, event_type, revision_no,
  from_status, to_status, from_compliance_status, to_compliance_status,
  created_at
)
SELECT
  c.id, c.creator_citizen_id, 'draft_created', c.revision_no,
  NULL, c.status, NULL, c.compliance_status, c.created_at
FROM crowdfunding_campaigns c
WHERE NOT EXISTS (
  SELECT 1
  FROM crowdfunding_campaign_lifecycle_events e
  WHERE e.campaign_id = c.id
    AND e.event_type = 'draft_created'
);

CREATE OR REPLACE FUNCTION create_crowdfunding_campaign_lifecycle_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO crowdfunding_campaign_lifecycle_events (
    campaign_id, actor_citizen_id, event_type, revision_no,
    from_status, to_status, from_compliance_status, to_compliance_status,
    created_at
  ) VALUES (
    NEW.id, NEW.creator_citizen_id, 'draft_created', NEW.revision_no,
    NULL, NEW.status, NULL, NEW.compliance_status, NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crowdfunding_campaign_lifecycle_insert ON crowdfunding_campaigns;
CREATE TRIGGER trg_crowdfunding_campaign_lifecycle_insert
AFTER INSERT ON crowdfunding_campaigns
FOR EACH ROW
EXECUTE FUNCTION create_crowdfunding_campaign_lifecycle_event();

-- Database-level guard against skipping the review gate. Existing operational
-- transitions remain possible, but a campaign may not jump from draft directly
-- into a public/financial state, nor from review directly to active.
CREATE OR REPLACE FUNCTION enforce_crowdfunding_campaign_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'draft'
     AND NEW.status IN ('verified', 'active', 'funded', 'executing', 'verifying', 'completed') THEN
    RAISE EXCEPTION 'crowdfunding campaign must pass review before public activation'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'review'
     AND NEW.status IN ('active', 'funded', 'executing', 'verifying', 'completed') THEN
    RAISE EXCEPTION 'crowdfunding campaign must be verified before activation'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status = 'verified'
     AND NEW.status IN ('funded', 'executing', 'verifying', 'completed') THEN
    RAISE EXCEPTION 'verified crowdfunding campaign must be activated before execution'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crowdfunding_campaign_lifecycle_guard ON crowdfunding_campaigns;
CREATE TRIGGER trg_crowdfunding_campaign_lifecycle_guard
BEFORE UPDATE OF status ON crowdfunding_campaigns
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION enforce_crowdfunding_campaign_lifecycle_transition();

-- The existing activation service remains the single business path for
-- readiness checks. Record the successful verified -> active transition at the
-- database boundary so it cannot disappear from the audit history if callers
-- change later.
CREATE OR REPLACE FUNCTION record_crowdfunding_campaign_activation_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO crowdfunding_campaign_lifecycle_events (
    campaign_id, actor_citizen_id, event_type, revision_no,
    from_status, to_status, from_compliance_status, to_compliance_status
  ) VALUES (
    NEW.id, NEW.creator_citizen_id, 'activated', NEW.revision_no,
    OLD.status, NEW.status, OLD.compliance_status, NEW.compliance_status
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crowdfunding_campaign_lifecycle_activation ON crowdfunding_campaigns;
CREATE TRIGGER trg_crowdfunding_campaign_lifecycle_activation
AFTER UPDATE OF status ON crowdfunding_campaigns
FOR EACH ROW
WHEN (OLD.status = 'verified' AND NEW.status = 'active')
EXECUTE FUNCTION record_crowdfunding_campaign_activation_event();

-- Phase 7 — platform-native scheduled civic publishing.
-- Civic reputation remains completely separate from this queue and from the
-- usage ledger introduced by 20260908184500_billing_usage_counters.

-- Widen the metric allowlist introduced by the AI usage ledger so the same
-- durable counters table can also meter Pro-gated scheduled publications,
-- without duplicating the table or its accounting semantics.
ALTER TABLE billing_usage_counters
  DROP CONSTRAINT IF EXISTS billing_usage_counters_metric_check;
ALTER TABLE billing_usage_counters
  ADD CONSTRAINT billing_usage_counters_metric_check CHECK (
    metric IN ('ai_request', 'scheduled_post')
  );

CREATE TABLE IF NOT EXISTS scheduled_civic_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  neighborhood VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  scheduled_for TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_civic_publications_status_check CHECK (
    status IN ('scheduled', 'published', 'cancelled', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_scheduled_civic_publications_owner
  ON scheduled_civic_publications (citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_civic_publications_due
  ON scheduled_civic_publications (status, scheduled_for)
  WHERE status = 'scheduled';

COMMENT ON TABLE scheduled_civic_publications IS
  'Plan-gated platform-native civic publishing queue. Publication never changes civic reputation by itself.';

ALTER TABLE civic_activity_validations
  DROP CONSTRAINT IF EXISTS civic_activity_validations_type_check;
ALTER TABLE civic_activity_validations
  ADD CONSTRAINT civic_activity_validations_type_check
  CHECK (activity_type IN ('report', 'proposal', 'publication'));

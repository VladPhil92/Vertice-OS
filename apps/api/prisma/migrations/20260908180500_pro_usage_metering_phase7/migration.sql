-- Phase 7 — durable quota metering and publishing automation.
-- Civic reputation remains completely separate from this ledger.

CREATE TABLE IF NOT EXISTS billing_usage_counters (
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  metric VARCHAR(40) NOT NULL,
  period_start DATE NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (citizen_id, metric, period_start),
  CONSTRAINT billing_usage_metric_check CHECK (
    metric IN ('ai_requests', 'evidence_storage_bytes', 'scheduled_posts')
  ),
  CONSTRAINT billing_usage_quantity_check CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_billing_usage_period
  ON billing_usage_counters (period_start, metric);

COMMENT ON TABLE billing_usage_counters IS
  'Monthly operational capacity counters. Never read by reputation or ranking logic.';

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

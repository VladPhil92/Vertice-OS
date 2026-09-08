-- Phase 7 — durable quota metering for capacity-bearing product features.
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

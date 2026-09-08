-- Phase 7 — server-authoritative capacity metering.
--
-- Usage counters are deliberately isolated from reputation and civic scoring.
-- A plan purchase changes capacity only; it never changes civic authority.

CREATE TABLE IF NOT EXISTS billing_usage_counters (
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  metric VARCHAR(48) NOT NULL,
  period_start DATE NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (citizen_id, metric, period_start),
  CONSTRAINT billing_usage_counters_metric_check CHECK (
    metric IN ('ai_request')
  )
);

CREATE INDEX IF NOT EXISTS billing_usage_counters_period_idx
  ON billing_usage_counters (metric, period_start, used);

COMMENT ON TABLE billing_usage_counters IS
  'Operational usage capacity only. Never feeds reputation, ranking, voting weight or civic authority.';

-- Finance Operations Command Center — Phase IV
--
-- Durable emergency-stop controls are deliberately narrow: they only prevent
-- NEW money instructions. Reconciliation, cancellation, refunds and provider
-- webhooks must remain available while an incident is being contained.
--
-- Missing rows are not interpreted as enabled/disabled application state;
-- the application treats a control-plane read failure as fail-closed for new
-- money movement.

CREATE TABLE IF NOT EXISTS finance_runtime_controls (
  capability VARCHAR(40) PRIMARY KEY,
  emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  updated_by_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_runtime_controls_capability_check CHECK (
    capability IN ('pro_checkout', 'crowdfunding_collection', 'crowdfunding_payouts')
  ),
  CONSTRAINT finance_runtime_controls_reason_check CHECK (
    emergency_stop = FALSE OR (reason IS NOT NULL AND length(trim(reason)) >= 8)
  )
);

INSERT INTO finance_runtime_controls (capability, emergency_stop)
VALUES
  ('pro_checkout', FALSE),
  ('crowdfunding_collection', FALSE),
  ('crowdfunding_payouts', FALSE)
ON CONFLICT (capability) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_finance_runtime_controls_stopped
  ON finance_runtime_controls (emergency_stop, updated_at DESC);

COMMENT ON TABLE finance_runtime_controls IS
  'Superadmin-controlled emergency stops for new financial instructions. Never used to alter civic reputation, ranking, identity or governance authority.';

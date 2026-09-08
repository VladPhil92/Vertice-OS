-- Finance operations phase III
--
-- This migration adds operational control-plane state around the payment ledger.
-- It does NOT introduce payout destinations, bank account data, or automatic
-- disbursements. Money movement remains provider-owned and fail-closed.

CREATE TABLE IF NOT EXISTS payment_refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  provider VARCHAR(50) NOT NULL,
  provider_refund_id VARCHAR(191),
  idempotency_key VARCHAR(80) NOT NULL,
  amount_cop BIGINT NOT NULL CHECK (amount_cop > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'requested',
  requested_by_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT payment_refund_requests_status_check CHECK (
    status IN ('requested', 'processing', 'succeeded', 'failed', 'reconciliation_required')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_refund_requests_idempotency_key
  ON payment_refund_requests (payment_transaction_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payment_refund_requests_status
  ON payment_refund_requests (status, created_at ASC);

CREATE TABLE IF NOT EXISTS payment_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  trigger_kind VARCHAR(20) NOT NULL DEFAULT 'manual',
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  scanned_count INTEGER NOT NULL DEFAULT 0,
  changed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  CONSTRAINT payment_reconciliation_runs_trigger_check CHECK (
    trigger_kind IN ('manual', 'job')
  ),
  CONSTRAINT payment_reconciliation_runs_status_check CHECK (
    status IN ('running', 'succeeded', 'partial', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_runs_started
  ON payment_reconciliation_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS payment_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES payment_reconciliation_runs(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  provider_resource_id VARCHAR(191),
  before_status VARCHAR(32) NOT NULL,
  after_status VARCHAR(32) NOT NULL,
  result VARCHAR(20) NOT NULL,
  error_code VARCHAR(80),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_reconciliation_items_result_check CHECK (
    result IN ('synced', 'unchanged', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_reconciliation_items_run_tx
  ON payment_reconciliation_items (run_id, payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_items_result
  ON payment_reconciliation_items (result, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES crowdfunding_campaigns(id) ON DELETE SET NULL,
  rule_code VARCHAR(80) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  CONSTRAINT payment_risk_flags_severity_check CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT payment_risk_flags_status_check CHECK (
    status IN ('open', 'reviewed', 'dismissed', 'escalated')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_risk_flags_open_rule_tx
  ON payment_risk_flags (rule_code, payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_payment_risk_flags_queue
  ON payment_risk_flags (status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_risk_flags_campaign
  ON payment_risk_flags (campaign_id, detected_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payout_operation_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  evidence_reference VARCHAR(300),
  notes TEXT,
  certified_by_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  certified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payout_operation_certifications_status_check CHECK (
    status IN ('pending', 'verified', 'rejected', 'suspended')
  ),
  CONSTRAINT payout_operation_certifications_verified_evidence_check CHECK (
    status <> 'verified' OR evidence_reference IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_payout_operation_certifications_provider
  ON payout_operation_certifications (provider, certified_at DESC);

-- No payout destination, account number, bank token, card data, or automatic
-- transfer instruction is stored by this phase.
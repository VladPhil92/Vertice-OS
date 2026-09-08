-- Crowdfunding payouts phase IV
--
-- Wompi Pagos a Terceros BRE-B v2 is the payout rail. VÉRTICE deliberately
-- does not persist beneficiary bank accounts, legal IDs, BRE-B key values,
-- beneficiary names/emails or raw webhook payee payloads. Only provider
-- references, a keyed destination fingerprint and operational state are durable.

CREATE TABLE IF NOT EXISTS crowdfunding_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(id) ON DELETE RESTRICT,
  beneficiary_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  provider VARCHAR(50) NOT NULL,
  provider_payout_id VARCHAR(191),
  provider_transaction_id VARCHAR(191),
  provider_reference VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  amount_cop BIGINT NOT NULL CHECK (amount_cop > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  status VARCHAR(32) NOT NULL DEFAULT 'requested',
  provider_status VARCHAR(40),
  destination_kind VARCHAR(20) NOT NULL DEFAULT 'breb',
  destination_fingerprint CHAR(64) NOT NULL,
  destination_key_type VARCHAR(32) NOT NULL,
  preview_confirmed_at TIMESTAMPTZ NOT NULL,
  requested_by_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  failure_code VARCHAR(80),
  failure_message TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT crowdfunding_payout_requests_currency_check CHECK (currency = 'COP'),
  CONSTRAINT crowdfunding_payout_requests_destination_check CHECK (destination_kind = 'breb'),
  CONSTRAINT crowdfunding_payout_requests_key_type_check CHECK (
    destination_key_type IN ('ALPHANUMERIC', 'MAIL', 'PHONE', 'IDENTIFICATION', 'ESTABLISHMENT_CODE')
  ),
  CONSTRAINT crowdfunding_payout_requests_status_check CHECK (
    status IN (
      'requested', 'pending_approval', 'processing', 'paid', 'failed',
      'not_approved', 'cancelled', 'reconciliation_required'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crowdfunding_payout_requests_provider_idempotency
  ON crowdfunding_payout_requests (provider, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS crowdfunding_payout_requests_provider_payout
  ON crowdfunding_payout_requests (provider, provider_payout_id)
  WHERE provider_payout_id IS NOT NULL;

-- MVP invariant: at most one non-failed payout lifecycle may exist per campaign.
-- A rejected/not-approved/failed attempt may be retried with a new request.
CREATE UNIQUE INDEX IF NOT EXISTS crowdfunding_payout_requests_campaign_active
  ON crowdfunding_payout_requests (campaign_id)
  WHERE status IN (
    'requested', 'pending_approval', 'processing', 'paid', 'reconciliation_required'
  );

CREATE INDEX IF NOT EXISTS idx_crowdfunding_payout_requests_status
  ON crowdfunding_payout_requests (status, updated_at ASC);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_payout_requests_beneficiary
  ON crowdfunding_payout_requests (beneficiary_citizen_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payout_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_key CHAR(64) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  provider_resource_id VARCHAR(191),
  checksum CHAR(64) NOT NULL,
  signature_timestamp VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payout_webhook_events_status_check CHECK (
    status IN ('received', 'processed', 'ignored', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS payout_webhook_events_provider_key
  ON payout_webhook_events (provider, event_key);
CREATE INDEX IF NOT EXISTS idx_payout_webhook_events_resource
  ON payout_webhook_events (provider, provider_resource_id, received_at DESC)
  WHERE provider_resource_id IS NOT NULL;

-- No BRE-B key, account number, legal ID, beneficiary email/name, raw provider
-- payload or provider credential is stored by this migration.

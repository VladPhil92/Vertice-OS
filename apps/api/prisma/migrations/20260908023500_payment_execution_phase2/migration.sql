-- Payment execution phase II
--
-- Safety invariants:
-- 1. A browser redirect never activates Pro or marks a contribution paid.
-- 2. Provider webhooks are deduplicated before mutating local ledgers.
-- 3. Checkout creation is idempotent at the citizen + kind boundary.
-- 4. Crowdfunding checkout remains impossible until the campaign creator has
--    a verified payout profile and the global feature flag is explicitly on.
-- 5. No payout instruction or bank credential is stored in this phase.

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_idempotency_key
  ON payment_transactions (citizen_id, kind, idempotency_key)
  WHERE citizen_id IS NOT NULL AND idempotency_key IS NOT NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_provider_sync_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  provider_event_id VARCHAR(191) NOT NULL,
  provider_request_id VARCHAR(191),
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(191) NOT NULL,
  signature_timestamp VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT payment_webhook_events_status_check CHECK (
    status IN ('received', 'processed', 'ignored', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_event_key
  ON payment_webhook_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_resource
  ON payment_webhook_events (provider, resource_type, resource_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_status
  ON payment_webhook_events (status, received_at DESC);

CREATE TABLE IF NOT EXISTS crowdfunding_payout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL UNIQUE REFERENCES citizens(id) ON DELETE CASCADE,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payout_status VARCHAR(20) NOT NULL DEFAULT 'disabled',
  provider VARCHAR(50),
  provider_reference VARCHAR(191),
  review_notes TEXT,
  requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  reviewed_by_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crowdfunding_payout_profiles_verification_check CHECK (
    verification_status IN ('pending', 'in_review', 'verified', 'rejected', 'suspended')
  ),
  CONSTRAINT crowdfunding_payout_profiles_status_check CHECK (
    payout_status IN ('disabled', 'eligible', 'blocked')
  ),
  CONSTRAINT crowdfunding_payout_profiles_verified_eligible_check CHECK (
    payout_status <> 'eligible' OR verification_status = 'verified'
  )
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_payout_profiles_review
  ON crowdfunding_payout_profiles (verification_status, requested_at ASC NULLS LAST);

-- Explicitly no banking/payout destination fields are introduced here. The
-- provider-owned payout destination/KYB handoff belongs to the next certified
-- payout adapter phase, so VÉRTICE does not start storing raw financial data.

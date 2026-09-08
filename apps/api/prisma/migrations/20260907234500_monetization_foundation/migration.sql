-- Monetization foundation v1
--
-- Product invariants:
-- 1. An absent subscription row means VÉRTICE Free.
-- 2. Payments, subscriptions and crowdfunding money never write civic reputation.
-- 3. Crowdfunding v1 only permits donation/reward funding. Equity, debt and
--    profit/revenue sharing are rejected at both application and DB boundaries.
-- 4. Campaign creation is not activation: compliance_status must be verified
--    before a campaign can be publicly listed or later enabled for payments.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  plan_code VARCHAR(20) NOT NULL DEFAULT 'pro',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  billing_cycle VARCHAR(20),
  provider VARCHAR(50),
  provider_customer_id VARCHAR(191),
  provider_subscription_id VARCHAR(191),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_plan_check CHECK (plan_code IN ('free', 'pro')),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  CONSTRAINT subscriptions_cycle_check CHECK (
    billing_cycle IS NULL OR billing_cycle IN ('monthly', 'annual')
  ),
  CONSTRAINT subscriptions_paid_plan_cycle_check CHECK (
    plan_code = 'free' OR billing_cycle IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_key
  ON subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

-- At most one entitlement-bearing subscription can be live for a citizen.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_citizen
  ON subscriptions (citizen_id)
  WHERE status IN ('trialing', 'active');

CREATE INDEX IF NOT EXISTS idx_subscriptions_citizen_history
  ON subscriptions (citizen_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  kind VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  provider VARCHAR(50) NOT NULL,
  provider_transaction_id VARCHAR(191),
  amount_cop BIGINT NOT NULL,
  platform_fee_cop BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_transactions_kind_check CHECK (
    kind IN ('subscription', 'crowdfunding_contribution', 'platform_tip', 'refund', 'payout')
  ),
  CONSTRAINT payment_transactions_status_check CHECK (
    status IN ('pending', 'authorized', 'paid', 'failed', 'refunded', 'chargeback', 'cancelled')
  ),
  CONSTRAINT payment_transactions_amount_check CHECK (amount_cop >= 0),
  CONSTRAINT payment_transactions_fee_check CHECK (platform_fee_cop >= 0),
  CONSTRAINT payment_transactions_currency_check CHECK (currency = 'COP')
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_key
  ON payment_transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_citizen
  ON payment_transactions (citizen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON payment_transactions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS crowdfunding_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  title VARCHAR(120) NOT NULL,
  slug VARCHAR(90) NOT NULL UNIQUE,
  summary VARCHAR(280) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  funding_model VARCHAR(20) NOT NULL DEFAULT 'donation',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  compliance_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  goal_amount_cop BIGINT NOT NULL,
  raised_amount_cop BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  locality_id INTEGER REFERENCES localities(id) ON DELETE SET NULL,
  neighborhood VARCHAR(120),
  budget JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crowdfunding_campaigns_category_check CHECK (
    category IN (
      'social', 'community', 'culture', 'education', 'environment',
      'animal_welfare', 'sports', 'public_space', 'technology_civic',
      'social_entrepreneurship', 'heritage'
    )
  ),
  CONSTRAINT crowdfunding_campaigns_funding_model_check CHECK (
    funding_model IN ('donation', 'reward')
  ),
  CONSTRAINT crowdfunding_campaigns_status_check CHECK (
    status IN (
      'draft', 'review', 'verified', 'active', 'funded', 'executing',
      'verifying', 'completed', 'suspended', 'investigation'
    )
  ),
  CONSTRAINT crowdfunding_campaigns_compliance_check CHECK (
    compliance_status IN ('pending', 'in_review', 'verified', 'rejected', 'suspended')
  ),
  CONSTRAINT crowdfunding_campaigns_goal_check CHECK (goal_amount_cop >= 50000),
  CONSTRAINT crowdfunding_campaigns_raised_check CHECK (raised_amount_cop >= 0),
  CONSTRAINT crowdfunding_campaigns_currency_check CHECK (currency = 'COP'),
  CONSTRAINT crowdfunding_campaigns_schedule_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
  ),
  CONSTRAINT crowdfunding_campaigns_public_requires_compliance CHECK (
    status NOT IN ('verified', 'active', 'funded', 'executing', 'verifying', 'completed')
    OR compliance_status = 'verified'
  )
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_creator
  ON crowdfunding_campaigns (creator_citizen_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_public
  ON crowdfunding_campaigns (status, created_at DESC)
  WHERE compliance_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_territory
  ON crowdfunding_campaigns (locality_id, neighborhood, status);

CREATE TABLE IF NOT EXISTS crowdfunding_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(id) ON DELETE RESTRICT,
  contributor_citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  amount_cop BIGINT NOT NULL,
  platform_tip_cop BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crowdfunding_contributions_amount_check CHECK (amount_cop > 0),
  CONSTRAINT crowdfunding_contributions_tip_check CHECK (platform_tip_cop >= 0),
  CONSTRAINT crowdfunding_contributions_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'refunded', 'chargeback', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS crowdfunding_contributions_payment_key
  ON crowdfunding_contributions (payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crowdfunding_contributions_campaign
  ON crowdfunding_contributions (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_contributions_citizen
  ON crowdfunding_contributions (contributor_citizen_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crowdfunding_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  target_amount_cop BIGINT,
  status VARCHAR(24) NOT NULL DEFAULT 'planned',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crowdfunding_milestones_amount_check CHECK (
    target_amount_cop IS NULL OR target_amount_cop >= 0
  ),
  CONSTRAINT crowdfunding_milestones_status_check CHECK (
    status IN ('planned', 'in_progress', 'submitted', 'verified', 'disputed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_milestones_campaign
  ON crowdfunding_milestones (campaign_id, created_at ASC);

CREATE TABLE IF NOT EXISTS crowdfunding_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES crowdfunding_campaigns(id) ON DELETE CASCADE,
  author_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crowdfunding_updates_campaign
  ON crowdfunding_updates (campaign_id, created_at DESC);

-- Explicitly no trigger or FK from monetization tables into reputation_events.
-- Reputation changes remain the responsibility of the civic evidence/reputation
-- bounded context and must be based on validated civic outcomes, not money.

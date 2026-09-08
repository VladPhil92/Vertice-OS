-- Align crowdfunding persistence with the public API policy and Dashboard category-first flow.
-- This migration is additive except for replacing the category CHECK with the canonical 12-category allowlist.

ALTER TABLE crowdfunding_campaigns
  ADD COLUMN IF NOT EXISTS funding_policy VARCHAR(24);

UPDATE crowdfunding_campaigns
SET funding_policy = CASE
  WHEN funding_model = 'reward' THEN 'all_or_nothing'
  ELSE 'flexible'
END
WHERE funding_policy IS NULL;

ALTER TABLE crowdfunding_campaigns
  ALTER COLUMN funding_policy SET DEFAULT 'flexible',
  ALTER COLUMN funding_policy SET NOT NULL;

ALTER TABLE crowdfunding_campaigns
  DROP CONSTRAINT IF EXISTS crowdfunding_campaigns_category_check;

ALTER TABLE crowdfunding_campaigns
  ADD CONSTRAINT crowdfunding_campaigns_category_check CHECK (
    category IN (
      'social', 'emergency', 'community', 'culture', 'education', 'environment',
      'animal_welfare', 'sports', 'public_space', 'technology_civic',
      'social_entrepreneurship', 'heritage'
    )
  );

ALTER TABLE crowdfunding_campaigns
  DROP CONSTRAINT IF EXISTS crowdfunding_campaigns_funding_policy_check;

ALTER TABLE crowdfunding_campaigns
  ADD CONSTRAINT crowdfunding_campaigns_funding_policy_check CHECK (
    funding_policy IN ('flexible', 'all_or_nothing', 'milestone')
  );

ALTER TABLE crowdfunding_campaigns
  DROP CONSTRAINT IF EXISTS crowdfunding_campaigns_reward_policy_check;

ALTER TABLE crowdfunding_campaigns
  ADD CONSTRAINT crowdfunding_campaigns_reward_policy_check CHECK (
    funding_model <> 'reward' OR funding_policy <> 'flexible'
  );

COMMENT ON COLUMN crowdfunding_campaigns.funding_policy IS
  'Collection rule selected for the campaign: flexible, all_or_nothing or milestone. Reward campaigns cannot be flexible.';

-- Crowdfunding monetization — Phase V
--
-- Product policy:
-- - verified social/emergency donation campaigns: 1.00% VÉRTICE fee;
-- - all other donation/community/cultural/educational/civic campaigns: 2.50%;
-- - reward/prepurchase campaigns: 3.50%;
-- - platform tips remain optional and are excluded from the fee base;
-- - the platform fee is deducted from contribution principal, never added as a
--   hidden surcharge to the donor.
--
-- The `funding_policy` column, its value/category constraints and the
-- reward-cannot-be-flexible rule were already introduced by migration
-- 20260908143000_crowdfunding_category_policy_alignment. This migration adds
-- only what that one did not: the funding-policy index, the flexible-payout
-- unique index adjustment, and canonical fee enforcement.

CREATE INDEX IF NOT EXISTS idx_crowdfunding_campaigns_funding_policy
  ON crowdfunding_campaigns (funding_policy, status, updated_at DESC);

-- Phase IV permitted only one successful payout lifecycle per campaign. Flexible
-- funding requires repeated withdrawals while preserving at-most-one in-flight
-- money movement for a campaign. A previously paid payout must not block a new
-- one, unlike Phase IV's all-or-nothing single-payout campaigns.
DROP INDEX IF EXISTS crowdfunding_payout_requests_campaign_active;
DROP INDEX IF EXISTS crowdfunding_payout_requests_campaign_inflight;
CREATE UNIQUE INDEX crowdfunding_payout_requests_campaign_inflight
  ON crowdfunding_payout_requests (campaign_id)
  WHERE status IN ('requested', 'pending_approval', 'processing', 'reconciliation_required');

-- Canonical fee enforcement lives in PostgreSQL as a second line of defence.
-- Application code currently inserts platform_fee_cop=0; this trigger replaces
-- it with the policy-derived immutable fee snapshot before the row is stored.
CREATE OR REPLACE FUNCTION apply_vertice_crowdfunding_platform_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  campaign_uuid UUID;
  campaign_category TEXT;
  campaign_funding_model TEXT;
  campaign_compliance_status TEXT;
  tip_cop BIGINT := 0;
  principal_cop BIGINT;
  fee_bps INTEGER;
BEGIN
  IF NEW.kind <> 'crowdfunding_contribution' THEN
    RETURN NEW;
  END IF;

  IF NEW.metadata IS NULL OR COALESCE(NEW.metadata->>'campaign_id', '') = '' THEN
    RAISE EXCEPTION 'CROWDFUNDING_CAMPAIGN_METADATA_REQUIRED';
  END IF;

  campaign_uuid := (NEW.metadata->>'campaign_id')::uuid;

  SELECT category, funding_model, compliance_status
  INTO campaign_category, campaign_funding_model, campaign_compliance_status
  FROM crowdfunding_campaigns
  WHERE id = campaign_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CROWDFUNDING_CAMPAIGN_NOT_FOUND';
  END IF;

  IF NEW.metadata ? 'platform_tip_cop' THEN
    tip_cop := GREATEST(COALESCE((NEW.metadata->>'platform_tip_cop')::bigint, 0), 0);
  END IF;

  principal_cop := NEW.amount_cop - tip_cop;
  IF principal_cop <= 0 THEN
    RAISE EXCEPTION 'INVALID_CROWDFUNDING_FEE_BASE';
  END IF;

  IF campaign_funding_model = 'reward' THEN
    fee_bps := 350;
  ELSIF campaign_compliance_status = 'verified'
    AND campaign_category IN ('social', 'emergency') THEN
    fee_bps := 100;
  ELSE
    fee_bps := 250;
  END IF;

  NEW.platform_fee_cop := ROUND((principal_cop::numeric * fee_bps::numeric) / 10000)::bigint;
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'platform_fee_bps', fee_bps,
    'platform_fee_policy_version', '2026-09-v1',
    'platform_fee_base_cop', principal_cop
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_transactions_crowdfunding_platform_fee
  ON payment_transactions;
CREATE TRIGGER trg_payment_transactions_crowdfunding_platform_fee
BEFORE INSERT ON payment_transactions
FOR EACH ROW
WHEN (NEW.kind = 'crowdfunding_contribution')
EXECUTE FUNCTION apply_vertice_crowdfunding_platform_fee();

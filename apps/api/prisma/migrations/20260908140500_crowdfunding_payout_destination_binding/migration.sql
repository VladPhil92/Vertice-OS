-- Binds crowdfunding payouts to a beneficiary-registered destination.
--
-- Phase IV's admin payout flow re-resolves the BRE-B key the admin types
-- against Wompi and requires the admin to echo Wompi's masked holder/entity,
-- but never checked that this destination actually belongs to the campaign
-- creator's own verified payout profile. That left a fund-diversion gap: any
-- admin session could redirect a payout to an arbitrary BRE-B key as long as
-- the creator had *some* verified profile.
--
-- This closes the gap: the beneficiary self-registers their own destination
-- (resolved and confirmed the same way as an admin payout request), and the
-- payout request path now requires the admin-submitted destination
-- fingerprint to match the beneficiary's own registered one.
ALTER TABLE crowdfunding_payout_profiles
  ADD COLUMN IF NOT EXISTS destination_fingerprint CHAR(64),
  ADD COLUMN IF NOT EXISTS destination_key_type VARCHAR(20);

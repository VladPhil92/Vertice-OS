-- Civic social identity is intentionally separate from citizens.role.
-- `role` remains an authorization/security concern; these fields describe how
-- a person presents their public community work inside VÉRTICE.

ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS civic_profile_type VARCHAR(30) NOT NULL DEFAULT 'citizen',
  ADD COLUMN IF NOT EXISTS civic_bio VARCHAR(600),
  ADD COLUMN IF NOT EXISTS civic_organization VARCHAR(180),
  ADD COLUMN IF NOT EXISTS public_civic_profile BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE citizens
  DROP CONSTRAINT IF EXISTS citizens_civic_profile_type_check;

ALTER TABLE citizens
  ADD CONSTRAINT citizens_civic_profile_type_check
  CHECK (civic_profile_type IN ('citizen', 'social_leader', 'candidate', 'organization_rep', 'public_official'));

CREATE INDEX IF NOT EXISTS idx_citizens_public_civic_profile
  ON citizens (civic_profile_type, reputation_score DESC)
  WHERE public_civic_profile = TRUE AND is_active = TRUE;

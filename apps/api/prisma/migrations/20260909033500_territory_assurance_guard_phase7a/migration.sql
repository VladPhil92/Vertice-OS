-- Phase 7A — Territory assurance boundary.
-- A citizen may self-select a municipality for discovery/community context, but
-- self-asserted location MUST NOT create governance eligibility.

ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS territory_assurance_level SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS territory_assurance_source VARCHAR(40) NOT NULL DEFAULT 'self_asserted',
  ADD COLUMN IF NOT EXISTS territory_verified_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE citizens ADD CONSTRAINT citizens_territory_assurance_level_check
    CHECK (territory_assurance_level BETWEEN 0 AND 2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE proposal_voter_roll
  ADD COLUMN IF NOT EXISTS territory_assurance_level SMALLINT NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE proposal_voter_roll ADD CONSTRAINT proposal_voter_roll_territory_assurance_check
    CHECK (territory_assurance_level BETWEEN 0 AND 2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_citizens_territory_assurance
  ON citizens (territory_code, territory_assurance_level, is_active);

-- Existing Cartagena locality/profile data remains useful as product context but
-- is not silently upgraded into verified residence evidence.
UPDATE citizens
SET territory_assurance_level = 0,
    territory_assurance_source = CASE WHEN territory_code IS NULL THEN 'unbound' ELSE 'legacy_profile' END,
    territory_verified_at = NULL
WHERE territory_assurance_level = 0;

UPDATE proposal_voter_roll pvr
SET territory_assurance_level = c.territory_assurance_level
FROM citizens c
WHERE pvr.citizen_id = c.id;

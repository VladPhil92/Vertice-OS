-- Social Graph & Evidence v2
-- Followers are a discovery/subscription primitive only. They never contribute
-- directly to the VÉRTICE reputation score.

CREATE TABLE IF NOT EXISTS civic_profile_follows (
  follower_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT civic_profile_follows_no_self_follow CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_civic_profile_follows_followed
  ON civic_profile_follows (followed_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_profile_follows_follower
  ON civic_profile_follows (follower_id, created_at DESC);

-- Polymorphic activity validation. activity_id points to either a territorial
-- report or proposal according to activity_type. The application verifies that
-- the source exists before writes because PostgreSQL cannot express a foreign
-- key that targets one of two tables.
CREATE TABLE IF NOT EXISTS civic_activity_validations (
  activity_type VARCHAR(20) NOT NULL,
  activity_id UUID NOT NULL,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  stance VARCHAR(20) NOT NULL,
  note VARCHAR(280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_type, activity_id, citizen_id),
  CONSTRAINT civic_activity_validations_type_check
    CHECK (activity_type IN ('report', 'proposal')),
  CONSTRAINT civic_activity_validations_stance_check
    CHECK (stance IN ('corroborate', 'dispute'))
);

CREATE INDEX IF NOT EXISTS idx_civic_activity_validations_activity
  ON civic_activity_validations (activity_type, activity_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_activity_validations_citizen
  ON civic_activity_validations (citizen_id, updated_at DESC);
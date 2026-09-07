-- Civic profile identity media.
-- Public avatar media is intentionally kept separate from identity proofing:
-- verification_level remains the source of truth for verified identity, while
-- these columns only describe the image the citizen elects to publish.

ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS civic_avatar_asset_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS civic_avatar_pending_asset_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS civic_avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS civic_avatar_status VARCHAR(24) NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS civic_avatar_policy_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS civic_avatar_updated_at TIMESTAMPTZ;

ALTER TABLE citizens
  DROP CONSTRAINT IF EXISTS citizens_civic_avatar_status_check;

ALTER TABLE citizens
  ADD CONSTRAINT citizens_civic_avatar_status_check
  CHECK (civic_avatar_status IN ('missing', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_citizens_public_civic_avatar
  ON citizens (id)
  WHERE public_civic_profile = TRUE
    AND is_active = TRUE
    AND civic_avatar_status = 'approved'
    AND civic_avatar_url IS NOT NULL;

COMMENT ON COLUMN citizens.civic_avatar_asset_id IS
  'Opaque image-provider asset id for the currently approved public civic avatar.';
COMMENT ON COLUMN citizens.civic_avatar_pending_asset_id IS
  'Short-lived image-provider asset id awaiting direct-upload confirmation.';
COMMENT ON COLUMN citizens.civic_avatar_policy_attested_at IS
  'Timestamp when the citizen explicitly attested the civic portrait publication requirements.';

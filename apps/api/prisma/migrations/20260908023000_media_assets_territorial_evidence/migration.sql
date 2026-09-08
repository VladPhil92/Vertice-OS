-- Phase 3 — shared media assets + territorial evidence provenance.
-- Legacy territorial_reports.media_urls remains the public/read projection for
-- compatibility, while all new report evidence writes must originate from a
-- confirmed media asset owned by the reporting citizen.

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  provider_asset_id VARCHAR(191) NOT NULL,
  owner_citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  purpose VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT media_assets_provider_asset_unique UNIQUE (provider, provider_asset_id),
  CONSTRAINT media_assets_purpose_check CHECK (
    purpose IN ('civic_profile_avatar', 'territorial_report_evidence')
  ),
  CONSTRAINT media_assets_status_check CHECK (
    status IN ('pending', 'confirmed', 'attached', 'rejected', 'deleted')
  )
);

CREATE INDEX IF NOT EXISTS idx_media_assets_owner_purpose
  ON media_assets (owner_citizen_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_pending_expiry
  ON media_assets (expires_at)
  WHERE status = 'pending' AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS territorial_report_media (
  report_id UUID NOT NULL REFERENCES territorial_reports(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (report_id, media_asset_id),
  CONSTRAINT territorial_report_media_asset_unique UNIQUE (media_asset_id),
  CONSTRAINT territorial_report_media_position_unique UNIQUE (report_id, position),
  CONSTRAINT territorial_report_media_position_check CHECK (position BETWEEN 0 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_territorial_report_media_report
  ON territorial_report_media (report_id, position);

COMMENT ON TABLE media_assets IS
  'Provider-backed media provenance. New evidence must be confirmed and owner-bound before attachment.';
COMMENT ON TABLE territorial_report_media IS
  'Immutable attachment provenance for report evidence; max five positions per report.';
COMMENT ON COLUMN territorial_reports.media_urls IS
  'Compatibility/read projection. New writes are derived server-side from confirmed territorial_report_media assets.';

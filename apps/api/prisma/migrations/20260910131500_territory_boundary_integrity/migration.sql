-- Phase 7F — National geographic integrity
-- Stores authoritative municipal/district polygons separately from the canonical
-- territory catalog and records how each report's selected territory was verified.

CREATE TABLE IF NOT EXISTS territory_boundary_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  source_version VARCHAR(40),
  status VARCHAR(20) NOT NULL,
  features_seen INTEGER NOT NULL DEFAULT 0,
  features_upserted INTEGER NOT NULL DEFAULT 0,
  features_skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT territory_boundary_sync_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_territory_boundary_sync_provider
  ON territory_boundary_sync_runs (provider, completed_at DESC);

CREATE TABLE IF NOT EXISTS territory_boundaries (
  territory_code VARCHAR(32) PRIMARY KEY REFERENCES territories(code) ON DELETE CASCADE,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  source VARCHAR(40) NOT NULL,
  source_version VARCHAR(40) NOT NULL,
  source_checksum CHAR(64) NOT NULL,
  area_sq_km NUMERIC(14, 3),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territory_boundaries_nonempty_check CHECK (NOT ST_IsEmpty(geometry))
);

CREATE INDEX IF NOT EXISTS idx_territory_boundaries_geometry
  ON territory_boundaries USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_territory_boundaries_source
  ON territory_boundaries (source, source_version, synced_at DESC);

ALTER TABLE territorial_reports
  ADD COLUMN IF NOT EXISTS territory_validation VARCHAR(32);
ALTER TABLE territorial_reports
  ADD COLUMN IF NOT EXISTS territory_boundary_version VARCHAR(40);

UPDATE territorial_reports
SET territory_validation = 'legacy_unverified'
WHERE territory_validation IS NULL;

DO $$ BEGIN
  ALTER TABLE territorial_reports
    ADD CONSTRAINT territorial_reports_territory_validation_check
    CHECK (territory_validation IS NULL OR territory_validation IN (
      'polygon_verified',
      'border_tolerance',
      'catalog_unavailable',
      'legacy_unverified'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE territory_boundaries IS
  'Authoritative municipal/district polygons used to validate contribution coordinates; not a citizen movement-history store.';
COMMENT ON COLUMN territorial_reports.territory_validation IS
  'Creation-time geographic verification result. Historical rows remain legacy_unverified.';
COMMENT ON COLUMN territorial_reports.territory_boundary_version IS
  'Boundary source version used for creation-time point-in-polygon validation when available.';

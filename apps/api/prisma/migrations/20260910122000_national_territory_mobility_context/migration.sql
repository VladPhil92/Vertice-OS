-- National territory mobility context
-- Separates a citizen's durable home territory from a transient active context
-- and from the immutable target territory of each civic contribution.

CREATE TABLE IF NOT EXISTS citizen_territory_contexts (
  citizen_id UUID PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
  active_territory_code VARCHAR(32) NOT NULL REFERENCES territories(code) ON DELETE RESTRICT,
  source VARCHAR(16) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT citizen_territory_context_source_check CHECK (source IN ('manual', 'gps'))
);

CREATE INDEX IF NOT EXISTS idx_citizen_territory_context_active
  ON citizen_territory_contexts (active_territory_code, updated_at DESC);

ALTER TABLE territorial_reports
  ADD COLUMN IF NOT EXISTS territory_source VARCHAR(32);
ALTER TABLE civic_actions
  ADD COLUMN IF NOT EXISTS territory_source VARCHAR(32);

UPDATE territorial_reports
SET territory_source = 'legacy_home_fallback'
WHERE territory_source IS NULL AND territory_code IS NOT NULL;

UPDATE civic_actions
SET territory_source = 'legacy_home_fallback'
WHERE territory_source IS NULL AND territory_code IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE territorial_reports
    ADD CONSTRAINT territorial_reports_territory_source_check
    CHECK (territory_source IS NULL OR territory_source IN ('manual', 'gps', 'legacy_home_fallback'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE civic_actions
    ADD CONSTRAINT civic_actions_territory_source_check
    CHECK (territory_source IS NULL OR territory_source IN ('manual', 'gps', 'legacy_home_fallback'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contribution targets are always Colombian municipality/district nodes. This
-- is intentionally independent from the citizen's home territory.
CREATE OR REPLACE FUNCTION assert_colombian_contribution_territory(target_code VARCHAR)
RETURNS VOID AS $$
BEGIN
  IF target_code IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM territories t
    WHERE t.code = target_code
      AND t.country_code = 'CO'
      AND t.level IN ('municipality', 'district')
  ) THEN
    RAISE EXCEPTION 'Contribution territory must be a Colombian municipality or district: %', target_code
      USING ERRCODE = '23514';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Backward-compatible fallback for old callers: if no explicit target is sent,
-- snapshot the citizen's home territory. New clients send the target explicitly.
CREATE OR REPLACE FUNCTION snapshot_report_territory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.territory_code IS NULL AND NEW.citizen_id IS NOT NULL THEN
    SELECT territory_code INTO NEW.territory_code FROM citizens WHERE id = NEW.citizen_id;
    IF NEW.territory_code IS NOT NULL AND NEW.territory_source IS NULL THEN
      NEW.territory_source := 'legacy_home_fallback';
    END IF;
  ELSIF NEW.territory_code IS NOT NULL AND NEW.territory_source IS NULL THEN
    NEW.territory_source := 'manual';
  END IF;

  PERFORM assert_colombian_contribution_territory(NEW.territory_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION snapshot_civic_action_territory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.territory_code IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT territory_code INTO NEW.territory_code FROM citizens WHERE id = NEW.actor_id;
    IF NEW.territory_code IS NOT NULL AND NEW.territory_source IS NULL THEN
      NEW.territory_source := 'legacy_home_fallback';
    END IF;
  ELSIF NEW.territory_code IS NOT NULL AND NEW.territory_source IS NULL THEN
    NEW.territory_source := 'manual';
  END IF;

  PERFORM assert_colombian_contribution_territory(NEW.territory_code);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Active context must obey the same national municipal boundary. Exact device
-- coordinates are deliberately not persisted in this table.
CREATE OR REPLACE FUNCTION validate_citizen_territory_context() RETURNS TRIGGER AS $$
BEGIN
  PERFORM assert_colombian_contribution_territory(NEW.active_territory_code);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citizen_territory_context_validate ON citizen_territory_contexts;
CREATE TRIGGER citizen_territory_context_validate
BEFORE INSERT OR UPDATE ON citizen_territory_contexts
FOR EACH ROW EXECUTE FUNCTION validate_citizen_territory_context();

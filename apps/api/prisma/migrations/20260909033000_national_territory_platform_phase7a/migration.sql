-- Phase 7A — National Platform Readiness
-- National territory hierarchy + backward-compatible Cartagena bootstrap.
-- DANE/DIVIPOLA codes are stored as external_code for official department and
-- municipality/district nodes. VÉRTICE internal codes remain stable even if a
-- source label changes.

CREATE TABLE IF NOT EXISTS territories (
  code VARCHAR(32) PRIMARY KEY,
  external_code VARCHAR(16),
  name VARCHAR(160) NOT NULL,
  level VARCHAR(24) NOT NULL,
  parent_code VARCHAR(32),
  country_code CHAR(2) NOT NULL DEFAULT 'CO',
  slug VARCHAR(180) NOT NULL UNIQUE,
  activation_status VARCHAR(30) NOT NULL DEFAULT 'available',
  source VARCHAR(40) NOT NULL DEFAULT 'vertice',
  source_version VARCHAR(40),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territories_level_check CHECK (
    level IN ('country','department','municipality','district','locality','commune','neighborhood','vereda')
  ),
  CONSTRAINT territories_activation_status_check CHECK (
    activation_status IN ('available','emerging','community_active','pilot_ready','verified_network')
  ),
  CONSTRAINT territories_parent_fkey FOREIGN KEY (parent_code)
    REFERENCES territories(code) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS territories_source_level_external_key
  ON territories (source, level, external_code)
  WHERE external_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_territories_parent_level
  ON territories (parent_code, level, name);
CREATE INDEX IF NOT EXISTS idx_territories_activation
  ON territories (level, activation_status, name);
CREATE INDEX IF NOT EXISTS idx_territories_external_code
  ON territories (external_code);

CREATE TABLE IF NOT EXISTS territory_catalog_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  source_version VARCHAR(40),
  status VARCHAR(20) NOT NULL,
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_upserted INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT territory_catalog_sync_status_check CHECK (status IN ('running','succeeded','failed'))
);
CREATE INDEX IF NOT EXISTS idx_territory_catalog_sync_provider
  ON territory_catalog_sync_runs (provider, completed_at DESC);

INSERT INTO territories (code, external_code, name, level, parent_code, slug, activation_status, source, source_version)
VALUES ('CO', NULL, 'Colombia', 'country', NULL, 'colombia', 'available', 'vertice', 'phase7a-bootstrap')
ON CONFLICT (code) DO NOTHING;

-- Department-level DIVIPOLA bootstrap (2-digit codes).
INSERT INTO territories (code, external_code, name, level, parent_code, slug, source, source_version)
VALUES
  ('CO-DP-05','05','Antioquia','department','CO','antioquia','dane_divipola','MGN_2025'),
  ('CO-DP-08','08','Atlántico','department','CO','atlantico','dane_divipola','MGN_2025'),
  ('CO-DP-11','11','Bogotá, D.C.','department','CO','bogota-dc-departamento','dane_divipola','MGN_2025'),
  ('CO-DP-13','13','Bolívar','department','CO','bolivar','dane_divipola','MGN_2025'),
  ('CO-DP-15','15','Boyacá','department','CO','boyaca','dane_divipola','MGN_2025'),
  ('CO-DP-17','17','Caldas','department','CO','caldas','dane_divipola','MGN_2025'),
  ('CO-DP-18','18','Caquetá','department','CO','caqueta','dane_divipola','MGN_2025'),
  ('CO-DP-19','19','Cauca','department','CO','cauca','dane_divipola','MGN_2025'),
  ('CO-DP-20','20','Cesar','department','CO','cesar','dane_divipola','MGN_2025'),
  ('CO-DP-23','23','Córdoba','department','CO','cordoba','dane_divipola','MGN_2025'),
  ('CO-DP-25','25','Cundinamarca','department','CO','cundinamarca','dane_divipola','MGN_2025'),
  ('CO-DP-27','27','Chocó','department','CO','choco','dane_divipola','MGN_2025'),
  ('CO-DP-41','41','Huila','department','CO','huila','dane_divipola','MGN_2025'),
  ('CO-DP-44','44','La Guajira','department','CO','la-guajira','dane_divipola','MGN_2025'),
  ('CO-DP-47','47','Magdalena','department','CO','magdalena','dane_divipola','MGN_2025'),
  ('CO-DP-50','50','Meta','department','CO','meta','dane_divipola','MGN_2025'),
  ('CO-DP-52','52','Nariño','department','CO','narino','dane_divipola','MGN_2025'),
  ('CO-DP-54','54','Norte de Santander','department','CO','norte-de-santander','dane_divipola','MGN_2025'),
  ('CO-DP-63','63','Quindío','department','CO','quindio','dane_divipola','MGN_2025'),
  ('CO-DP-66','66','Risaralda','department','CO','risaralda','dane_divipola','MGN_2025'),
  ('CO-DP-68','68','Santander','department','CO','santander','dane_divipola','MGN_2025'),
  ('CO-DP-70','70','Sucre','department','CO','sucre','dane_divipola','MGN_2025'),
  ('CO-DP-73','73','Tolima','department','CO','tolima','dane_divipola','MGN_2025'),
  ('CO-DP-76','76','Valle del Cauca','department','CO','valle-del-cauca','dane_divipola','MGN_2025'),
  ('CO-DP-81','81','Arauca','department','CO','arauca','dane_divipola','MGN_2025'),
  ('CO-DP-85','85','Casanare','department','CO','casanare','dane_divipola','MGN_2025'),
  ('CO-DP-86','86','Putumayo','department','CO','putumayo','dane_divipola','MGN_2025'),
  ('CO-DP-88','88','Archipiélago de San Andrés, Providencia y Santa Catalina','department','CO','san-andres-providencia','dane_divipola','MGN_2025'),
  ('CO-DP-91','91','Amazonas','department','CO','amazonas','dane_divipola','MGN_2025'),
  ('CO-DP-94','94','Guainía','department','CO','guainia','dane_divipola','MGN_2025'),
  ('CO-DP-95','95','Guaviare','department','CO','guaviare','dane_divipola','MGN_2025'),
  ('CO-DP-97','97','Vaupés','department','CO','vaupes','dane_divipola','MGN_2025'),
  ('CO-DP-99','99','Vichada','department','CO','vichada','dane_divipola','MGN_2025')
ON CONFLICT (code) DO NOTHING;

-- Initial national city nodes. The DANE sync expands the complete catalog.
INSERT INTO territories (code, external_code, name, level, parent_code, slug, activation_status, source, source_version, activated_at)
VALUES
  ('CO-MP-13001','13001','Cartagena de Indias','district','CO-DP-13','cartagena-de-indias','pilot_ready','dane_divipola','MGN_2025',NOW()),
  ('CO-MP-11001','11001','Bogotá, D.C.','district','CO-DP-11','bogota-dc','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-05001','05001','Medellín','municipality','CO-DP-05','medellin','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-76001','76001','Cali','municipality','CO-DP-76','cali','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-08001','08001','Barranquilla','district','CO-DP-08','barranquilla','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-68001','68001','Bucaramanga','municipality','CO-DP-68','bucaramanga','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-47001','47001','Santa Marta','district','CO-DP-47','santa-marta','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-54001','54001','Cúcuta','municipality','CO-DP-54','cucuta','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-66001','66001','Pereira','municipality','CO-DP-66','pereira','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-17001','17001','Manizales','municipality','CO-DP-17','manizales','available','dane_divipola','MGN_2025',NULL),
  ('CO-MP-63001','63001','Armenia','municipality','CO-DP-63','armenia-quindio','available','dane_divipola','MGN_2025',NULL)
ON CONFLICT (code) DO NOTHING;

-- Legacy Cartagena locality nodes. Their IDs/codes remain untouched in the
-- historical `localities` table; this mapping only places them in the national tree.
INSERT INTO territories (code, name, level, parent_code, slug, activation_status, source, source_version)
VALUES
  ('CO-CTG-LOC-01','Histórica y del Caribe Norte','locality','CO-MP-13001','cartagena-historica-caribe-norte','pilot_ready','vertice','legacy-localities'),
  ('CO-CTG-LOC-02','De la Virgen y Turística','locality','CO-MP-13001','cartagena-virgen-turistica','pilot_ready','vertice','legacy-localities'),
  ('CO-CTG-LOC-03','Industrial y de la Bahía','locality','CO-MP-13001','cartagena-industrial-bahia','pilot_ready','vertice','legacy-localities'),
  ('CO-CTG-LOC-04','Bayunca','locality','CO-MP-13001','cartagena-bayunca','pilot_ready','vertice','legacy-localities')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS legacy_locality_territories (
  locality_id INTEGER PRIMARY KEY REFERENCES localities(id) ON DELETE CASCADE,
  territory_code VARCHAR(32) NOT NULL REFERENCES territories(code) ON DELETE RESTRICT
);

INSERT INTO legacy_locality_territories (locality_id, territory_code)
SELECT l.id,
  CASE l.code
    WHEN 'CTG-01' THEN 'CO-CTG-LOC-01'
    WHEN 'CTG-02' THEN 'CO-CTG-LOC-02'
    WHEN 'CTG-03' THEN 'CO-CTG-LOC-03'
    WHEN 'CTG-04' THEN 'CO-CTG-LOC-04'
  END
FROM localities l
WHERE l.code IN ('CTG-01','CTG-02','CTG-03','CTG-04')
ON CONFLICT (locality_id) DO UPDATE SET territory_code = EXCLUDED.territory_code;

ALTER TABLE citizens ADD COLUMN IF NOT EXISTS territory_code VARCHAR(32);
ALTER TABLE territorial_reports ADD COLUMN IF NOT EXISTS territory_code VARCHAR(32);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS territory_code VARCHAR(32);
ALTER TABLE proposal_voter_roll ADD COLUMN IF NOT EXISTS territory_code VARCHAR(32);
ALTER TABLE civic_actions ADD COLUMN IF NOT EXISTS territory_code VARCHAR(32);

DO $$ BEGIN
  ALTER TABLE citizens ADD CONSTRAINT citizens_territory_code_fkey
    FOREIGN KEY (territory_code) REFERENCES territories(code) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE territorial_reports ADD CONSTRAINT territorial_reports_territory_code_fkey
    FOREIGN KEY (territory_code) REFERENCES territories(code) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE proposals ADD CONSTRAINT proposals_territory_code_fkey
    FOREIGN KEY (territory_code) REFERENCES territories(code) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE proposal_voter_roll ADD CONSTRAINT proposal_voter_roll_territory_code_fkey
    FOREIGN KEY (territory_code) REFERENCES territories(code) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE civic_actions ADD CONSTRAINT civic_actions_territory_code_fkey
    FOREIGN KEY (territory_code) REFERENCES territories(code) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_citizens_territory ON citizens (territory_code, is_active, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_territory ON territorial_reports (territory_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_territory ON proposals (territory_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voter_roll_territory ON proposal_voter_roll (proposal_id, territory_code);
CREATE INDEX IF NOT EXISTS idx_civic_actions_territory_code ON civic_actions (territory_code, status, updated_at DESC);

-- Backfill only records that already carry an explicit Cartagena locality. We
-- intentionally do not assume that every pre-national citizen belongs to Cartagena.
UPDATE citizens c
SET territory_code = 'CO-MP-13001'
WHERE c.territory_code IS NULL
  AND EXISTS (SELECT 1 FROM legacy_locality_territories m WHERE m.locality_id = c.locality_id);
UPDATE territorial_reports r
SET territory_code = 'CO-MP-13001'
WHERE r.territory_code IS NULL
  AND EXISTS (SELECT 1 FROM legacy_locality_territories m WHERE m.locality_id = r.locality_id);
UPDATE proposals p
SET territory_code = 'CO-MP-13001'
WHERE p.territory_code IS NULL
  AND EXISTS (SELECT 1 FROM legacy_locality_territories m WHERE m.locality_id = p.locality_id);
UPDATE civic_actions a
SET territory_code = 'CO-MP-13001'
WHERE a.territory_code IS NULL
  AND EXISTS (SELECT 1 FROM legacy_locality_territories m WHERE m.locality_id = a.locality_id);
UPDATE proposal_voter_roll pvr
SET territory_code = c.territory_code
FROM citizens c
WHERE pvr.citizen_id = c.id AND pvr.territory_code IS NULL;

-- Immutable territory snapshots for new civic objects. Changing the citizen's
-- active municipality later never rewrites historical reports/actions/proposals.
CREATE OR REPLACE FUNCTION snapshot_report_territory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.territory_code IS NULL AND NEW.citizen_id IS NOT NULL THEN
    SELECT territory_code INTO NEW.territory_code FROM citizens WHERE id = NEW.citizen_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS territorial_reports_snapshot_territory ON territorial_reports;
CREATE TRIGGER territorial_reports_snapshot_territory
BEFORE INSERT ON territorial_reports
FOR EACH ROW EXECUTE FUNCTION snapshot_report_territory();

CREATE OR REPLACE FUNCTION snapshot_proposal_territory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.territory_code IS NULL AND NEW.author_id IS NOT NULL THEN
    SELECT territory_code INTO NEW.territory_code FROM citizens WHERE id = NEW.author_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS proposals_snapshot_territory ON proposals;
CREATE TRIGGER proposals_snapshot_territory
BEFORE INSERT ON proposals
FOR EACH ROW EXECUTE FUNCTION snapshot_proposal_territory();

CREATE OR REPLACE FUNCTION snapshot_civic_action_territory() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.territory_code IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT territory_code INTO NEW.territory_code FROM citizens WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS civic_actions_snapshot_territory ON civic_actions;
CREATE TRIGGER civic_actions_snapshot_territory
BEFORE INSERT ON civic_actions
FOR EACH ROW EXECUTE FUNCTION snapshot_civic_action_territory();

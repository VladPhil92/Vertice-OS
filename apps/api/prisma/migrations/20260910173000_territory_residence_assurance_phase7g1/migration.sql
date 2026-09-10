-- Phase 7G.1 — Proof-backed territorial residence assurance core.
--
-- This layer deliberately separates a citizen's selected home territory from
-- auditable residence assurance. GPS, contribution geography, identity proofing,
-- reputation and financial activity must never elevate territorial assurance.

-- Keep this migration self-contained for bounded integration environments while
-- remaining compatible with the Phase 7A assurance-guard migration in production.
ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS territory_assurance_level SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS territory_assurance_source VARCHAR(40) NOT NULL DEFAULT 'self_asserted',
  ADD COLUMN IF NOT EXISTS territory_verified_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE citizens ADD CONSTRAINT citizens_territory_assurance_level_check
    CHECK (territory_assurance_level BETWEEN 0 AND 2);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS territory_assurance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  territory_code VARCHAR(32) NOT NULL REFERENCES territories(code) ON DELETE RESTRICT,
  status VARCHAR(24) NOT NULL DEFAULT 'submitted',
  requested_level SMALLINT NOT NULL DEFAULT 1,
  evidence_type VARCHAR(40) NOT NULL,
  evidence_reference_digest CHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES citizens(id) ON DELETE SET NULL,
  decision_reason VARCHAR(500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territory_assurance_request_status_check CHECK (
    status IN ('submitted', 'verified', 'rejected', 'revoked', 'superseded')
  ),
  CONSTRAINT territory_assurance_request_level_check CHECK (requested_level BETWEEN 1 AND 2),
  CONSTRAINT territory_assurance_request_evidence_type_check CHECK (
    evidence_type IN ('secure_document', 'institutional_attestation', 'provider_attestation')
  ),
  CONSTRAINT territory_assurance_request_digest_check CHECK (
    evidence_reference_digest ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS territory_assurance_one_active_request
  ON territory_assurance_requests (citizen_id, territory_code)
  WHERE citizen_id IS NOT NULL AND status IN ('submitted', 'verified');

CREATE INDEX IF NOT EXISTS idx_territory_assurance_requests_review
  ON territory_assurance_requests (status, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_territory_assurance_requests_citizen
  ON territory_assurance_requests (citizen_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_territory_assurance_requests_territory
  ON territory_assurance_requests (territory_code, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS territory_assurance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES territory_assurance_requests(id) ON DELETE CASCADE,
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  territory_code VARCHAR(32) NOT NULL REFERENCES territories(code) ON DELETE RESTRICT,
  actor_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL,
  status_from VARCHAR(24),
  status_to VARCHAR(24) NOT NULL,
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territory_assurance_event_type_check CHECK (
    event_type IN ('submitted', 'verified', 'rejected', 'revoked', 'superseded')
  )
);

CREATE INDEX IF NOT EXISTS idx_territory_assurance_events_request
  ON territory_assurance_events (request_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_territory_assurance_events_citizen
  ON territory_assurance_events (citizen_id, created_at DESC);

ALTER TABLE citizens
  ADD COLUMN IF NOT EXISTS territory_assurance_request_id UUID;

DO $$ BEGIN
  ALTER TABLE citizens ADD CONSTRAINT citizens_territory_assurance_request_fkey
    FOREIGN KEY (territory_assurance_request_id)
    REFERENCES territory_assurance_requests(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_citizens_current_territory_assurance_request
  ON citizens (territory_assurance_request_id)
  WHERE territory_assurance_request_id IS NOT NULL;

-- A verified assurance elevation is valid only when it is backed by a durable,
-- already-verified request for this exact citizen and current municipality.
CREATE OR REPLACE FUNCTION enforce_current_territory_assurance_binding() RETURNS TRIGGER AS $$
DECLARE
  request_evidence_type VARCHAR(40);
  request_level SMALLINT;
BEGIN
  IF NEW.territory_assurance_level = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.territory_code IS NULL
     OR NEW.territory_verified_at IS NULL
     OR NEW.territory_assurance_request_id IS NULL THEN
    RAISE EXCEPTION 'verified territorial assurance requires territory, timestamp and request provenance';
  END IF;

  SELECT r.evidence_type, r.requested_level
    INTO request_evidence_type, request_level
  FROM territory_assurance_requests r
  WHERE r.id = NEW.territory_assurance_request_id
    AND r.citizen_id = NEW.id
    AND r.territory_code = NEW.territory_code
    AND r.status = 'verified';

  IF request_evidence_type IS NULL OR request_level IS NULL THEN
    RAISE EXCEPTION 'territorial assurance request is not verified for this citizen and territory';
  END IF;

  IF NEW.territory_assurance_level <> request_level THEN
    RAISE EXCEPTION 'territorial assurance level does not match verified request';
  END IF;

  IF NEW.territory_assurance_source <> ('assurance:' || request_evidence_type) THEN
    RAISE EXCEPTION 'territorial assurance source does not match verified request';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citizens_enforce_territory_assurance_binding ON citizens;
CREATE TRIGGER citizens_enforce_territory_assurance_binding
BEFORE UPDATE OF territory_assurance_level, territory_assurance_source,
  territory_verified_at, territory_assurance_request_id
ON citizens
FOR EACH ROW EXECUTE FUNCTION enforce_current_territory_assurance_binding();

-- Strengthen the existing Phase 7A reset: moving the durable home municipality
-- invalidates the current assurance and permanently supersedes its provenance.
CREATE OR REPLACE FUNCTION reset_territory_assurance_on_selection() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.territory_code IS DISTINCT FROM NEW.territory_code THEN
    IF OLD.territory_assurance_request_id IS NOT NULL THEN
      UPDATE territory_assurance_requests
      SET status = 'superseded', updated_at = NOW()
      WHERE id = OLD.territory_assurance_request_id
        AND status = 'verified';

      IF FOUND THEN
        INSERT INTO territory_assurance_events (
          request_id, citizen_id, territory_code, actor_id,
          event_type, status_from, status_to, reason
        ) VALUES (
          OLD.territory_assurance_request_id, OLD.id, OLD.territory_code, NULL,
          'superseded', 'verified', 'superseded', 'home_territory_changed'
        );
      END IF;
    END IF;

    NEW.territory_assurance_level := 0;
    NEW.territory_assurance_source := 'self_asserted';
    NEW.territory_verified_at := NULL;
    NEW.territory_assurance_request_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citizens_reset_territory_assurance ON citizens;
CREATE TRIGGER citizens_reset_territory_assurance
BEFORE UPDATE OF territory_code ON citizens
FOR EACH ROW EXECUTE FUNCTION reset_territory_assurance_on_selection();

COMMENT ON TABLE territory_assurance_requests IS
  'Auditable residence-assurance decisions. Raw evidence and raw GPS are never stored here; only a SHA-256 digest of an opaque secure evidence reference.';
COMMENT ON TABLE territory_assurance_events IS
  'Append-only decision history for territorial assurance lifecycle reconstruction.';
COMMENT ON COLUMN citizens.territory_assurance_request_id IS
  'Provenance pointer for the currently effective verified territorial assurance. Null whenever assurance level is zero.';

-- Phase 7G.2 corrective slice — canonical territorial-assurance timestamps.
--
-- PostgreSQL stores timestamptz with microsecond precision while the Node.js Date
-- boundary is millisecond precision. Governance provenance must not depend on a
-- lossy DB -> JavaScript -> DB timestamp round-trip. The database therefore
-- derives the citizen aggregate timestamp from the verified request itself.

CREATE OR REPLACE FUNCTION enforce_current_territory_assurance_binding() RETURNS TRIGGER AS $$
DECLARE
  request_evidence_type VARCHAR(40);
  request_level SMALLINT;
  request_verified_at TIMESTAMPTZ;
  request_expires_at TIMESTAMPTZ;
BEGIN
  IF NEW.territory_assurance_level = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.territory_code IS NULL
     OR NEW.territory_assurance_request_id IS NULL THEN
    RAISE EXCEPTION 'verified territorial assurance requires territory and request provenance';
  END IF;

  SELECT r.evidence_type, r.requested_level, r.verified_at, r.expires_at
    INTO request_evidence_type, request_level, request_verified_at, request_expires_at
  FROM territory_assurance_requests r
  WHERE r.id = NEW.territory_assurance_request_id
    AND r.citizen_id = NEW.id
    AND r.territory_code = NEW.territory_code
    AND r.status = 'verified';

  IF request_evidence_type IS NULL OR request_level IS NULL
     OR request_verified_at IS NULL OR request_expires_at IS NULL THEN
    RAISE EXCEPTION 'territorial assurance request is not verified for this citizen and territory';
  END IF;

  IF request_expires_at <= NOW() THEN
    RAISE EXCEPTION 'territorial assurance request is expired';
  END IF;

  IF NEW.territory_assurance_level <> request_level THEN
    RAISE EXCEPTION 'territorial assurance level does not match verified request';
  END IF;

  IF NEW.territory_assurance_source <> ('assurance:' || request_evidence_type) THEN
    RAISE EXCEPTION 'territorial assurance source does not match verified request';
  END IF;

  -- Canonical DB -> DB provenance: the request ledger, not an application
  -- timestamp parameter, is authoritative for the aggregate citizen field.
  NEW.territory_verified_at := request_verified_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_current_territory_assurance_binding() IS
  'Phase 7G.2: validates the exact verified request and canonicalizes citizens.territory_verified_at from durable request provenance.';

-- Phase 7G.2 — Verification & Governance Eligibility.
--
-- Current assurance determines admission only until an electorate is frozen.
-- After voting opens, proposal_voter_roll is the immutable source of authority.
-- Identity and residence provenance are therefore snapshotted into each row.

ALTER TABLE territory_assurance_requests
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Phase 7G.1 decisions predate explicit validity timestamps. Preserve their
-- audit history while giving existing verified decisions a bounded lifetime.
UPDATE territory_assurance_requests
SET verified_at = COALESCE(verified_at, reviewed_at, updated_at, submitted_at)
WHERE status = 'verified' AND verified_at IS NULL;

UPDATE territory_assurance_requests
SET expires_at = verified_at + INTERVAL '365 days'
WHERE status = 'verified' AND expires_at IS NULL AND verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_territory_assurance_expiry
  ON territory_assurance_requests (citizen_id, territory_code, expires_at)
  WHERE status = 'verified';

-- Multiple historical verified decisions are legitimate. The concurrency
-- invariant is one pending review at a time; a renewal may coexist with the
-- still-valid verification it is replacing.
DROP INDEX IF EXISTS territory_assurance_one_active_request;
CREATE UNIQUE INDEX IF NOT EXISTS territory_assurance_one_submitted_request
  ON territory_assurance_requests (citizen_id, territory_code)
  WHERE citizen_id IS NOT NULL AND status = 'submitted';

ALTER TABLE proposal_voter_roll
  ADD COLUMN IF NOT EXISTS territory_assurance_request_id UUID,
  ADD COLUMN IF NOT EXISTS territory_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS territory_assurance_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_proof_id UUID,
  ADD COLUMN IF NOT EXISTS identity_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_expires_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE proposal_voter_roll
    ADD CONSTRAINT proposal_voter_roll_assurance_request_fkey
    FOREIGN KEY (territory_assurance_request_id)
    REFERENCES territory_assurance_requests(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE proposal_voter_roll
    ADD CONSTRAINT proposal_voter_roll_identity_proof_fkey
    FOREIGN KEY (identity_proof_id)
    REFERENCES civic_identity_proofs(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_voter_roll_assurance_provenance
  ON proposal_voter_roll (proposal_id, territory_assurance_request_id)
  WHERE territory_assurance_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voter_roll_identity_provenance
  ON proposal_voter_roll (proposal_id, identity_proof_id)
  WHERE identity_proof_id IS NOT NULL;

-- A current citizen assurance may only be elevated from an unexpired verified
-- request. The verified request is the canonical timestamp authority. PostgreSQL
-- keeps microsecond precision while JavaScript Date is millisecond precision, so
-- copying the request timestamp through the application would create a lossy
-- provenance round-trip. The trigger validates the exact request and writes the
-- canonical DB timestamp directly into the citizen aggregate.
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

  NEW.territory_verified_at := request_verified_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Every voter-roll insert must carry exact identity provenance. Subnational
-- rows additionally require fresh residence provenance and the proposal scope
-- must match that verified residence. Invalid direct writes fail closed.
CREATE OR REPLACE FUNCTION enforce_voter_roll_territory() RETURNS TRIGGER AS $$
DECLARE
  p_scope TEXT;
  p_territory VARCHAR(32);
  p_locality INTEGER;
  p_neighborhood TEXT;
  c_territory VARCHAR(32);
  c_assurance SMALLINT;
  c_request UUID;
  c_locality INTEGER;
  c_neighborhood TEXT;
  proof_provider VARCHAR(50);
  proof_verified_at TIMESTAMPTZ;
  proof_expires_at TIMESTAMPTZ;
  request_territory VARCHAR(32);
  request_level SMALLINT;
  request_verified_at TIMESTAMPTZ;
  request_expires_at TIMESTAMPTZ;
  proposal_department VARCHAR(32);
  request_department VARCHAR(32);
BEGIN
  SELECT scope, territory_code, locality_id, neighborhood
    INTO p_scope, p_territory, p_locality, p_neighborhood
  FROM proposals WHERE id = NEW.proposal_id;
  IF p_scope IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'voter-roll proposal is unavailable';
  END IF;

  SELECT territory_code, territory_assurance_level, territory_assurance_request_id,
         locality_id, neighborhood
    INTO c_territory, c_assurance, c_request, c_locality, c_neighborhood
  FROM citizens WHERE id = NEW.citizen_id;

  SELECT cip.provider, cip.verified_at, cip.expires_at
    INTO proof_provider, proof_verified_at, proof_expires_at
  FROM civic_identity_proofs cip
  WHERE cip.id = NEW.identity_proof_id
    AND cip.citizen_id = NEW.citizen_id
    AND cip.status = 'verified'
    AND cip.assurance_level >= 2
    AND cip.verified_at IS NOT NULL
    AND cip.verified_at <= NEW.frozen_at
    AND cip.revoked_at IS NULL
    AND (cip.expires_at IS NULL OR cip.expires_at > NEW.frozen_at);

  IF proof_provider IS NULL OR proof_verified_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'voter-roll identity provenance is not valid at freeze time';
  END IF;

  NEW.identity_provider := proof_provider;
  NEW.identity_verified_at := proof_verified_at;
  NEW.identity_expires_at := proof_expires_at;

  -- National participation remains identity-assurance based. Residence is not
  -- a national eligibility prerequisite and no residence request is asserted.
  IF p_scope = 'national' THEN
    NEW.territory_code := c_territory;
    NEW.territory_assurance_level := c_assurance;
    NEW.territory_assurance_request_id := NULL;
    NEW.territory_verified_at := NULL;
    NEW.territory_assurance_expires_at := NULL;
    RETURN NEW;
  END IF;

  IF p_territory IS NULL OR c_territory IS NULL OR c_assurance < 1
     OR c_request IS NULL OR NEW.territory_assurance_request_id IS NULL
     OR NEW.territory_assurance_request_id <> c_request THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'subnational voter-roll membership requires current territorial assurance provenance';
  END IF;

  SELECT r.territory_code, r.requested_level, r.verified_at, r.expires_at
    INTO request_territory, request_level, request_verified_at, request_expires_at
  FROM territory_assurance_requests r
  WHERE r.id = NEW.territory_assurance_request_id
    AND r.citizen_id = NEW.citizen_id
    AND r.status = 'verified'
    AND r.verified_at IS NOT NULL
    AND r.verified_at <= NEW.frozen_at
    AND r.expires_at IS NOT NULL
    AND r.expires_at > NEW.frozen_at;

  IF request_territory IS NULL OR request_level IS NULL
     OR request_verified_at IS NULL OR request_expires_at IS NULL
     OR request_territory <> c_territory
     OR request_level <> c_assurance THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'territorial assurance provenance is not valid at freeze time';
  END IF;

  IF p_scope = 'city' THEN
    IF request_territory <> p_territory THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'city voter-roll territory mismatch';
    END IF;
  ELSIF p_scope = 'regional' THEN
    SELECT parent_code INTO proposal_department FROM territories WHERE code = p_territory;
    SELECT parent_code INTO request_department FROM territories WHERE code = request_territory;
    IF proposal_department IS NULL OR request_department IS NULL
       OR proposal_department <> request_department THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'regional voter-roll territory mismatch';
    END IF;
  ELSIF p_scope = 'locality' THEN
    IF request_territory <> p_territory OR p_locality IS NULL
       OR c_locality IS DISTINCT FROM p_locality THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'locality voter-roll territory mismatch';
    END IF;
  ELSIF p_scope = 'neighborhood' THEN
    IF request_territory <> p_territory OR p_neighborhood IS NULL
       OR c_neighborhood IS DISTINCT FROM p_neighborhood THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'neighborhood voter-roll territory mismatch';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unsupported proposal scope for voter roll';
  END IF;

  NEW.territory_code := request_territory;
  NEW.territory_assurance_level := request_level;
  NEW.territory_verified_at := request_verified_at;
  NEW.territory_assurance_expires_at := request_expires_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Extend the already-installed immutable voter-roll guard with Phase 7G.2
-- provenance. The existing trigger continues to point at this function.
CREATE OR REPLACE FUNCTION protect_frozen_voter_roll()
RETURNS TRIGGER AS $$
DECLARE
  target_proposal_id UUID;
  vote_opened_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
    OR NEW.citizen_id IS DISTINCT FROM OLD.citizen_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'voter-roll proposal and citizen identity are immutable';
  END IF;

  target_proposal_id := CASE WHEN TG_OP = 'INSERT' THEN NEW.proposal_id ELSE OLD.proposal_id END;
  SELECT voting_starts_at INTO vote_opened_at FROM proposals WHERE id = target_proposal_id;

  IF vote_opened_at IS NOT NULL THEN
    IF TG_OP IN ('INSERT', 'DELETE') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'voter roll is immutable after voting opens';
    END IF;

    IF NEW.neighborhood IS DISTINCT FROM OLD.neighborhood
       OR NEW.locality_id IS DISTINCT FROM OLD.locality_id
       OR NEW.verification_level IS DISTINCT FROM OLD.verification_level
       OR NEW.eligibility_reason IS DISTINCT FROM OLD.eligibility_reason
       OR NEW.frozen_at IS DISTINCT FROM OLD.frozen_at
       OR NEW.territory_code IS DISTINCT FROM OLD.territory_code
       OR NEW.territory_assurance_level IS DISTINCT FROM OLD.territory_assurance_level
       OR NEW.territory_assurance_request_id IS DISTINCT FROM OLD.territory_assurance_request_id
       OR NEW.territory_verified_at IS DISTINCT FROM OLD.territory_verified_at
       OR NEW.territory_assurance_expires_at IS DISTINCT FROM OLD.territory_assurance_expires_at
       OR NEW.identity_proof_id IS DISTINCT FROM OLD.identity_proof_id
       OR NEW.identity_provider IS DISTINCT FROM OLD.identity_provider
       OR NEW.identity_verified_at IS DISTINCT FROM OLD.identity_verified_at
       OR NEW.identity_expires_at IS DISTINCT FROM OLD.identity_expires_at
       OR NEW.effective_delegate_id IS DISTINCT FROM OLD.effective_delegate_id
       OR NEW.source_delegation_id IS DISTINCT FROM OLD.source_delegation_id
       OR NEW.effective_delegation_type IS DISTINCT FROM OLD.effective_delegation_type
       OR NEW.delegation_frozen_at IS DISTINCT FROM OLD.delegation_frozen_at THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'voter roll is immutable after voting opens';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN territory_assurance_requests.expires_at IS
  'Phase 7G.2 authorization validity boundary. Default policy issues 365-day residence assurance.';
COMMENT ON COLUMN proposal_voter_roll.territory_assurance_request_id IS
  'Frozen residence-assurance provenance. Current citizen state cannot rewrite this election snapshot.';
COMMENT ON COLUMN proposal_voter_roll.identity_proof_id IS
  'Frozen civic identity proof provenance used at electorate admission time.';
COMMENT ON FUNCTION enforce_current_territory_assurance_binding() IS
  'Phase 7G.2 validates the exact verified request and canonicalizes citizens.territory_verified_at from durable database provenance.';

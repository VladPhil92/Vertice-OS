-- P0.2 — Production Identity Proofing foundation
--
-- Separate account federation (`external_identities`) from evidence that a
-- real-world identity proofing process actually reached a trusted state.
-- No raw document numbers, biometrics or provider payloads are stored here.

CREATE TABLE civic_identity_proofs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id          UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    provider            VARCHAR(50) NOT NULL,
    provider_reference  VARCHAR(191) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    assurance_level     SMALLINT NOT NULL DEFAULT 0,
    evidence_hash       VARCHAR(64),
    verified_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ,
    last_event_at       TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT civic_identity_proofs_status CHECK (
      status IN ('pending', 'review', 'verified', 'rejected', 'expired', 'revoked')
    ),
    CONSTRAINT civic_identity_proofs_level CHECK (assurance_level BETWEEN 0 AND 3),
    CONSTRAINT civic_identity_proofs_evidence_hash CHECK (
      evidence_hash IS NULL OR evidence_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT civic_identity_proofs_verified_state CHECK (
      status <> 'verified' OR (verified_at IS NOT NULL AND assurance_level >= 2)
    ),
    CONSTRAINT civic_identity_proofs_revoked_state CHECK (
      status <> 'revoked' OR revoked_at IS NOT NULL
    ),
    UNIQUE (provider, provider_reference)
);

CREATE INDEX idx_civic_identity_proofs_citizen
  ON civic_identity_proofs(citizen_id, updated_at DESC);

CREATE INDEX idx_civic_identity_proofs_active
  ON civic_identity_proofs(citizen_id, provider, assurance_level)
  WHERE status = 'verified' AND revoked_at IS NULL;

-- Append-only receipt of normalized, signed provider-adapter events. The event
-- idempotency key prevents webhook retries from mutating state twice.
CREATE TABLE civic_identity_proof_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            VARCHAR(50) NOT NULL,
    event_id            VARCHAR(191) NOT NULL,
    citizen_id          UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    provider_reference  VARCHAR(191) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    assurance_level     SMALLINT NOT NULL DEFAULT 0,
    evidence_hash       VARCHAR(64),
    occurred_at         TIMESTAMPTZ NOT NULL,
    expires_at          TIMESTAMPTZ,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT civic_identity_proof_events_status CHECK (
      status IN ('pending', 'review', 'verified', 'rejected', 'expired', 'revoked')
    ),
    CONSTRAINT civic_identity_proof_events_level CHECK (assurance_level BETWEEN 0 AND 3),
    CONSTRAINT civic_identity_proof_events_evidence_hash CHECK (
      evidence_hash IS NULL OR evidence_hash ~ '^[0-9a-f]{64}$'
    ),
    UNIQUE (provider, event_id)
);

CREATE INDEX idx_civic_identity_proof_events_citizen
  ON civic_identity_proof_events(citizen_id, received_at DESC);

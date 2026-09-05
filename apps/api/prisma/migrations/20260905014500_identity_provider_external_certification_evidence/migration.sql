-- P1.0 — External provider canary evidence ledger
--
-- A native provider cannot become governance-usable merely because an operator
-- toggled environment flags. This append-oriented ledger records the minimal,
-- PII-free evidence that an authenticated native lifecycle canary actually
-- traversed verified -> revoked -> expired before promotion.

CREATE TABLE civic_identity_provider_certifications (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider              VARCHAR(50) NOT NULL,
    contract_version      SMALLINT NOT NULL DEFAULT 1,
    evidence_digest       VARCHAR(64) NOT NULL,
    subject_binding_hash  VARCHAR(64) NOT NULL,
    verified_event_id     VARCHAR(191) NOT NULL,
    revoked_event_id      VARCHAR(191) NOT NULL,
    expired_event_id      VARCHAR(191) NOT NULL,
    certified_by          UUID REFERENCES citizens(id) ON DELETE SET NULL,
    certified_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by            UUID REFERENCES citizens(id) ON DELETE SET NULL,
    revoked_at            TIMESTAMPTZ,
    revocation_reason     VARCHAR(500),

    CONSTRAINT civic_identity_provider_certifications_provider CHECK (
      provider ~ '^[a-z0-9][a-z0-9_.-]{0,49}$'
    ),
    CONSTRAINT civic_identity_provider_certifications_contract CHECK (
      contract_version = 1
    ),
    CONSTRAINT civic_identity_provider_certifications_digest CHECK (
      evidence_digest ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT civic_identity_provider_certifications_subject_hash CHECK (
      subject_binding_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT civic_identity_provider_certifications_distinct_events CHECK (
      verified_event_id <> revoked_event_id
      AND verified_event_id <> expired_event_id
      AND revoked_event_id <> expired_event_id
    ),
    CONSTRAINT civic_identity_provider_certifications_revocation CHECK (
      (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
      OR (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
    ),
    UNIQUE (provider, evidence_digest)
);

CREATE UNIQUE INDEX idx_civic_identity_provider_certifications_active
  ON civic_identity_provider_certifications(provider)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_civic_identity_provider_certifications_history
  ON civic_identity_provider_certifications(provider, certified_at DESC);

COMMENT ON TABLE civic_identity_provider_certifications IS
  'P1.0 evidence-backed native provider certification. Contains no raw vendor payloads, document data or biometrics.';
COMMENT ON COLUMN civic_identity_provider_certifications.evidence_digest IS
  'SHA-256 over canonical minimal lifecycle evidence already authenticated at native ingress.';
COMMENT ON COLUMN civic_identity_provider_certifications.subject_binding_hash IS
  'SHA-256 commitment proving one citizen/provider-reference binding across the canary without persisting the reference here.';

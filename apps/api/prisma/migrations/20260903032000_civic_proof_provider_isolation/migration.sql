-- P0.4 — Provider-isolated civic proof ingress
--
-- Existing P0.2 events are retained as signature_version = 0. New events must
-- carry a provider-scoped key id and a bounded signature timestamp. No raw
-- signature or provider secret is persisted.

ALTER TABLE civic_identity_proof_events
  ADD COLUMN ingress_signature_version SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN ingress_key_id VARCHAR(64),
  ADD COLUMN ingress_signed_at TIMESTAMPTZ;

ALTER TABLE civic_identity_proof_events
  ADD CONSTRAINT civic_identity_proof_events_signature_version
    CHECK (ingress_signature_version IN (0, 1)),
  ADD CONSTRAINT civic_identity_proof_events_v1_provenance
    CHECK (
      ingress_signature_version = 0
      OR (
        ingress_key_id IS NOT NULL
        AND ingress_key_id ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'
        AND ingress_signed_at IS NOT NULL
      )
    );

CREATE INDEX idx_civic_identity_proof_events_ingress_key
  ON civic_identity_proof_events(provider, ingress_key_id, received_at DESC)
  WHERE ingress_signature_version = 1;

COMMENT ON COLUMN civic_identity_proof_events.ingress_signature_version IS
  '0=legacy P0.2 global-HMAC event; 1=provider-isolated timestamped HMAC envelope';
COMMENT ON COLUMN civic_identity_proof_events.ingress_key_id IS
  'Non-secret adapter key identifier used to audit rotations and accepted ingress';
COMMENT ON COLUMN civic_identity_proof_events.ingress_signed_at IS
  'Timestamp authenticated inside the adapter envelope; bounded at request time';

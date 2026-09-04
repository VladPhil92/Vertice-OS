-- P0.7 — Native provider webhook provenance
--
-- P0.4 introduced signature_version=1 for the authenticated internal
-- adapter -> VÉRTICE HMAC hop. P0.7 adds signature_version=2 for webhooks
-- verified directly by a compiled native provider adapter over the exact raw
-- vendor payload. Native signatures and raw payloads are never persisted.

ALTER TABLE civic_identity_proof_events
  DROP CONSTRAINT civic_identity_proof_events_signature_version,
  DROP CONSTRAINT civic_identity_proof_events_v1_provenance;

ALTER TABLE civic_identity_proof_events
  ADD CONSTRAINT civic_identity_proof_events_signature_version
    CHECK (ingress_signature_version IN (0, 1, 2)),
  ADD CONSTRAINT civic_identity_proof_events_provenance
    CHECK (
      (
        ingress_signature_version = 0
        AND ingress_key_id IS NULL
        AND ingress_signed_at IS NULL
      )
      OR (
        ingress_signature_version = 1
        AND ingress_key_id IS NOT NULL
        AND ingress_key_id ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$'
        AND ingress_signed_at IS NOT NULL
      )
      OR (
        ingress_signature_version = 2
        AND ingress_key_id IS NULL
        AND ingress_signed_at IS NOT NULL
      )
    );

COMMENT ON COLUMN civic_identity_proof_events.ingress_signature_version IS
  '0=legacy P0.2 event; 1=provider-isolated internal HMAC envelope; 2=compiled native provider webhook verification';
COMMENT ON COLUMN civic_identity_proof_events.ingress_key_id IS
  'Non-secret internal adapter key identifier. Null for native-provider provenance.';
COMMENT ON COLUMN civic_identity_proof_events.ingress_signed_at IS
  'Timestamp authenticated by the accepted ingress protocol; bounded at request time.';

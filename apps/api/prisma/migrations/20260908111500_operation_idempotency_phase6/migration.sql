-- Phase 6 — Durable operation idempotency & reconciliation
--
-- This ledger protects citizen-facing mutations across retries, refreshes and
-- concurrent requests. It deliberately stores only a request hash, never the
-- request payload, so identity/legal/civic content is not duplicated into an
-- infrastructure table.
--
-- Safety model:
-- - completed: replay the original successful response without re-executing;
-- - processing: fail closed while an operation is still in flight;
-- - failed: require a new logical operation/reconciliation instead of blindly
--   repeating a mutation whose side effects may be uncertain.

CREATE TABLE IF NOT EXISTS api_idempotency_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  scope VARCHAR(160) NOT NULL,
  idempotency_key VARCHAR(96) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  key_source VARCHAR(16) NOT NULL DEFAULT 'derived',
  state VARCHAR(24) NOT NULL DEFAULT 'processing',
  response_status INTEGER,
  response_body JSONB,
  failure_code VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT api_idempotency_receipts_key_source_check CHECK (
    key_source IN ('client', 'derived')
  ),
  CONSTRAINT api_idempotency_receipts_state_check CHECK (
    state IN ('processing', 'completed', 'failed')
  ),
  CONSTRAINT api_idempotency_receipts_response_status_check CHECK (
    response_status IS NULL OR response_status BETWEEN 100 AND 599
  ),
  CONSTRAINT api_idempotency_receipts_unique UNIQUE (
    citizen_id, scope, idempotency_key
  )
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_receipts_expiry
  ON api_idempotency_receipts (expires_at);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_receipts_state
  ON api_idempotency_receipts (state, updated_at DESC);

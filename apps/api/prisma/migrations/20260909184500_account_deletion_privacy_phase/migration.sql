-- Store Privacy / Account Deletion
--
-- Account deletion is implemented as irreversible identity erasure plus
-- pseudonymisation, not as a reversible "disabled account" flag. The citizen
-- row remains only as a referential-integrity anchor for civic, financial and
-- audit records that may require retention. No request row stores email,
-- document number, provider subject or other direct identifier.

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  request_source VARCHAR(20) NOT NULL,
  retention_policy_version VARCHAR(40) NOT NULL,
  retained_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT account_deletion_requests_status_check
    CHECK (status IN ('completed', 'blocked', 'failed')),
  CONSTRAINT account_deletion_requests_source_check
    CHECK (request_source IN ('web', 'mobile', 'api'))
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_citizen_unique
  ON account_deletion_requests (citizen_id)
  WHERE citizen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_deletion_requests_completed
  ON account_deletion_requests (completed_at DESC)
  WHERE status = 'completed';

COMMENT ON TABLE account_deletion_requests IS
  'PII-free receipt proving that an authenticated VERTICE account deletion request was executed.';

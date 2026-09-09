-- Phase 7C — National Citizen Activation & Public City Experience
--
-- This table records a citizen's voluntary interest in helping activate their
-- own territorial node. It is NOT an authorization table and MUST NOT be used
-- by auth, reputation, identity/territory assurance or governance eligibility.
-- Approval is an operational review signal only; assigning a 7B cohort remains
-- a separate, explicit superadmin action.

CREATE TABLE IF NOT EXISTS territory_activation_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_code TEXT NOT NULL REFERENCES territories(code) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  interest_role VARCHAR(24) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  message VARCHAR(500),
  reviewed_by UUID REFERENCES citizens(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territory_activation_interest_role_check CHECK (
    interest_role IN ('ambassador','organizer','observer')
  ),
  CONSTRAINT territory_activation_interest_status_check CHECK (
    status IN ('pending','approved','declined','withdrawn')
  ),
  UNIQUE (territory_code, citizen_id, interest_role)
);

CREATE INDEX IF NOT EXISTS idx_territory_activation_interests_queue
  ON territory_activation_interests (territory_code, status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_territory_activation_interests_citizen
  ON territory_activation_interests (citizen_id, updated_at DESC);

COMMENT ON TABLE territory_activation_interests IS
  'Phase 7C operational interest ledger. Rows grant no civic or administrative authority.';

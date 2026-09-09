CREATE TABLE IF NOT EXISTS mobile_push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  expo_push_token VARCHAR(255) NOT NULL UNIQUE,
  platform VARCHAR(16) NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version VARCHAR(64),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error_code VARCHAR(80),
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_devices_citizen_enabled
  ON mobile_push_devices (citizen_id, enabled, last_seen_at DESC);

COMMENT ON TABLE mobile_push_devices IS
  'Durable opt-in Expo push destinations. Tokens are routing credentials only and never confer civic identity, reputation, authority, eligibility, or financial state.';

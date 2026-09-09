CREATE TABLE IF NOT EXISTS mobile_push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  installation_id VARCHAR(128) NOT NULL,
  expo_push_token VARCHAR(255) NOT NULL,
  platform VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT mobile_push_devices_installation_key UNIQUE (installation_id),
  CONSTRAINT mobile_push_devices_token_key UNIQUE (expo_push_token),
  CONSTRAINT mobile_push_devices_platform_check CHECK (platform IN ('android', 'ios')),
  CONSTRAINT mobile_push_devices_status_check CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_devices_citizen_active
  ON mobile_push_devices (citizen_id, status, last_registered_at DESC);

COMMENT ON TABLE mobile_push_devices IS
  'Opaque app-installation registry for Expo push delivery. Tokens are delivery addresses only and never confer civic identity or authority.';

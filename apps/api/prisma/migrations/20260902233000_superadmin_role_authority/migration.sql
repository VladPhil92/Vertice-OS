-- Durable role grants + session-scoped active role.
-- citizens.role remains the default role for backwards compatibility; grants
-- are authoritative for privileged access.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS active_role TEXT NOT NULL DEFAULT 'citizen';

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_active_role_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_active_role_check
  CHECK (active_role IN ('citizen', 'moderator', 'admin', 'superadmin'));

CREATE TABLE IF NOT EXISTS citizen_role_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by_citizen_id UUID NULL REFERENCES citizens(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL,
  CONSTRAINT citizen_role_grants_role_check
    CHECK (role IN ('citizen', 'moderator', 'admin', 'superadmin')),
  CONSTRAINT citizen_role_grants_citizen_role_key UNIQUE (citizen_id, role)
);

CREATE INDEX IF NOT EXISTS idx_citizen_role_grants_active
  ON citizen_role_grants (citizen_id, role)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_citizen_role_grants_role_active
  ON citizen_role_grants (role, citizen_id)
  WHERE revoked_at IS NULL;

-- Every account can always act as a citizen.
INSERT INTO citizen_role_grants (citizen_id, role, source)
SELECT id, 'citizen', 'legacy_backfill'
FROM citizens
ON CONFLICT (citizen_id, role) DO NOTHING;

-- Preserve the pre-existing privileged role as an explicit grant.
INSERT INTO citizen_role_grants (citizen_id, role, source)
SELECT id, role, 'legacy_backfill'
FROM citizens
WHERE role IN ('moderator', 'admin', 'superadmin')
ON CONFLICT (citizen_id, role) DO NOTHING;

-- Existing sessions keep their prior effective role after the migration.
UPDATE sessions s
SET active_role = c.role
FROM citizens c
WHERE c.id = s.citizen_id
  AND c.role IN ('citizen', 'moderator', 'admin', 'superadmin');

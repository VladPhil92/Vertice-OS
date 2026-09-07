import fs from 'node:fs'
import path from 'node:path'

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260907210000_privilege_provenance_hardening/migration.sql',
)
const AUTH_SERVICE_PATH = path.resolve(__dirname, '../auth.service.ts')
const FEDERATION_SERVICE_PATH = path.resolve(__dirname, '../federation.service.ts')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

describe('P0 privilege provenance hardening contract', () => {
  it('does not derive local or refresh session authority from citizens.role', () => {
    const auth = read(AUTH_SERVICE_PATH)

    expect(auth).toContain("ensureBaselineRoleGrants(citizen.id, 'citizen')")
    expect(auth).toContain("ensureBaselineRoleGrants(session.citizen.id, 'citizen')")
    expect(auth).not.toContain('(citizen.role as CitizenRole)')
    expect(auth).not.toContain('(session.citizen.role as CitizenRole)')
  })

  it('does not derive ordinary federated session authority from citizens.role', () => {
    const federation = read(FEDERATION_SERVICE_PATH)

    expect(federation).toContain("ensureBaselineRoleGrants(citizen.id, 'citizen')")
    expect(federation).toContain('const activeRole = bootstrappedRole ?? baselineRole')
    expect(federation).not.toContain('(citizen.role as CitizenRole)')
  })

  it('hands authority to the canonical root before quarantining legacy privilege', () => {
    const sql = read(MIGRATION_PATH)
    const handover = sql.indexOf("INSERT INTO citizen_role_grants\n    (citizen_id, role, granted_by_citizen_id, source, granted_at, revoked_at)")
    const quarantine = sql.indexOf("UPDATE citizen_role_grants\nSET revoked_at = NOW()")

    expect(sql).toContain('CANONICAL_ROOT_REQUIRED_FOR_PRIVILEGE_HANDOVER')
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('vertice-superadmin-authority'))")
    expect(sql).toContain("unnest(ARRAY['moderator', 'admin', 'superadmin']::text[])")
    expect(handover).toBeGreaterThanOrEqual(0)
    expect(quarantine).toBeGreaterThan(handover)
  })

  it('requires canonical root handover only when legacy elevated authority exists', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain('legacy_elevated_exists BOOLEAN')
    expect(sql).toContain('IF legacy_elevated_exists IS NOT TRUE THEN')
    expect(sql).toContain('RETURN;')
  })

  it('revokes historical elevated grants and resets stale privileged sessions', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain("role IN ('moderator', 'admin', 'superadmin')")
    expect(sql).toContain("source IN ('legacy_role', 'legacy_backfill')")
    expect(sql).toContain("SET active_role = 'citizen'")
  })

  it('requires complete root-backed lineage for all elevated dashboard grants', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain("NEW.source NOT IN ('ctg_one_bootstrap', 'superadmin_dashboard')")
    expect(sql).toContain('UNTRUSTED_PRIVILEGED_GRANT_PROVENANCE')
    expect(sql).toContain('PRIVILEGED_GRANTOR_REQUIRED')
    expect(sql).toContain('UNAUTHORIZED_PRIVILEGED_GRANTOR')
    expect(sql).toContain('has_trusted_superadmin_lineage')
    expect(sql).toContain('WITH RECURSIVE lineage')
    expect(sql).toContain('NOT parent.citizen_id = ANY(child.path)')
    expect(sql).toContain('is_canonical_ctg_one_root')
    expect(sql).toContain("DIGEST(ei.provider_subject, 'sha256')")
    expect(sql).toContain('INVALID_EXISTING_DASHBOARD_PRIVILEGE_PROVENANCE')
  })
})

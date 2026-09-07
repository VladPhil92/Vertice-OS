import fs from 'node:fs'
import path from 'node:path'

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260907214500_canonical_root_grant_reconciliation/migration.sql',
)
const ROLES_SERVICE_PATH = path.resolve(__dirname, '../roles.service.ts')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

describe('P0 canonical root grant reconciliation', () => {
  it('keeps the canonical root continuously superadmin while removing redundant lower grants', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain("pg_advisory_xact_lock(hashtext('vertice-superadmin-authority'))")
    expect(sql).toContain("SET source = 'ctg_one_bootstrap'")
    expect(sql).toContain("role = 'superadmin'")
    expect(sql).toContain("role IN ('moderator', 'admin')")
    expect(sql).toContain('CANONICAL_ROOT_SUPERADMIN_STATE_MISMATCH')
    expect(sql).toContain('UNEXPECTED_ACTIVE_ADMIN_AFTER_ROOT_RECONCILIATION')
  })

  it('allows CTG One bootstrap provenance only for the canonical superadmin grant', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain("IF NEW.role <> 'superadmin' THEN")
    expect(sql).toContain('ROOT_BOOTSTRAP_ROLE_NOT_ALLOWED')
    expect(sql).toContain('CANONICAL_ROOT_GRANT_IMMUTABLE')
    expect(sql).toContain('has_trusted_superadmin_lineage')
  })

  it('does not manufacture root authority on a clean installation', () => {
    const sql = read(MIGRATION_PATH)

    expect(sql).toContain('elevated_exists BOOLEAN')
    expect(sql).toContain('IF elevated_exists IS NOT TRUE THEN')
    expect(sql).toContain('RETURN;')
  })

  it('prevents application baseline and bootstrap paths from recreating redundant roles', () => {
    const roles = read(ROLES_SERVICE_PATH)

    expect(roles).toContain("await ensureRoleGrant(citizenId, 'citizen', 'session_baseline')")
    expect(roles).toContain("return 'citizen'")
    expect(roles).not.toContain("await ensureRoleGrant(citizenId, preferredRole, 'legacy_role')")
    expect(roles).toContain("await ensureRoleGrantWithStore(tx, citizenId, 'superadmin', 'ctg_one_bootstrap')")
    expect(roles).not.toContain('for (const role of CITIZEN_ROLES)')
  })
})

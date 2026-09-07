import fs from 'node:fs'
import path from 'node:path'

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../prisma/migrations/20260907203000_root_authority_pinning/migration.sql',
)

function migrationSql(): string {
  return fs.readFileSync(MIGRATION_PATH, 'utf8')
}

describe('P0 root authority pinning contract', () => {
  it('pins the canonical root email and hashes the CTG One subject', () => {
    const sql = migrationSql()

    expect(sql).toContain("LOWER(c.email) = 'valderramapino@gmail.com'")
    expect(sql).toContain("DIGEST(ei.provider_subject, 'sha256')")
    expect(sql).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  })

  it('fails closed for CTG One bootstrap admin and superadmin grants', () => {
    const sql = migrationSql()

    expect(sql).toContain("NEW.source <> 'ctg_one_bootstrap'")
    expect(sql).toContain("NEW.role NOT IN ('admin', 'superadmin')")
    expect(sql).toContain('ROOT_SUPERADMIN_IDENTITY_MISMATCH')
    expect(sql).toContain('citizen_role_grants_root_authority_pin')
  })

  it('refuses deployment over an already-drifted bootstrap authority state', () => {
    const sql = migrationSql()

    expect(sql).toContain('ROOT_SUPERADMIN_EXISTING_IDENTITY_MISMATCH')
    expect(sql).toContain("g.source = 'ctg_one_bootstrap'")
    expect(sql).toContain("g.role IN ('admin', 'superadmin')")
    expect(sql).toContain('NOT EXISTS')
  })
})

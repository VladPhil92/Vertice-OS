import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

type ElevatedGrantRow = {
  citizen_id: string
  email: string
  role: 'admin' | 'superadmin'
  source: string
  granted_by_citizen_id: string | null
  grantor_email: string | null
  granted_at: Date
  revoked_at: Date | null
}

type RootIdentityRow = {
  provider: string
  provider_subject: string
}

const ROOT_EMAIL = 'valderramapino@gmail.com'
const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRawUnsafe<ElevatedGrantRow[]>(`
    SELECT
      g.citizen_id::text AS citizen_id,
      LOWER(c.email) AS email,
      g.role,
      g.source,
      g.granted_by_citizen_id::text AS granted_by_citizen_id,
      LOWER(grantor.email) AS grantor_email,
      g.granted_at,
      g.revoked_at
    FROM citizen_role_grants g
    INNER JOIN citizens c ON c.id = g.citizen_id
    LEFT JOIN citizens grantor ON grantor.id = g.granted_by_citizen_id
    WHERE g.revoked_at IS NULL
      AND g.role IN ('admin', 'superadmin')
    ORDER BY g.role ASC, LOWER(c.email) ASC
  `)

  const superadmins = rows.filter((row) => row.role === 'superadmin')
  const admins = rows.filter((row) => row.role === 'admin')
  const canonicalRoots = superadmins.filter((row) => row.email === ROOT_EMAIL)
  const legacyElevated = rows.filter((row) =>
    ['legacy_role', 'legacy_backfill'].includes(row.source),
  )

  let rootIdentities: RootIdentityRow[] = []
  if (canonicalRoots.length === 1) {
    rootIdentities = await prisma.$queryRawUnsafe<RootIdentityRow[]>(`
      SELECT provider, provider_subject
      FROM external_identities
      WHERE citizen_id = $1::uuid
        AND provider = 'ctg_one'
      ORDER BY created_at ASC
    `, canonicalRoots[0].citizen_id)
  }

  const safeRows = rows.map((row) => ({
    ...row,
    granted_at: row.granted_at.toISOString(),
    revoked_at: row.revoked_at?.toISOString() ?? null,
  }))
  const safeRootIdentities = rootIdentities.map((identity) => ({
    provider: identity.provider,
    provider_subject_sha256: createHash('sha256')
      .update(identity.provider_subject)
      .digest('hex'),
  }))

  const invariantPass =
    superadmins.length === 1 &&
    canonicalRoots.length === 1 &&
    admins.length === 0 &&
    legacyElevated.length === 0 &&
    rootIdentities.length >= 1

  console.log(`PRIVILEGE_AUDIT_ROWS=${JSON.stringify(safeRows)}`)
  console.log(
    `PRIVILEGE_AUDIT_COUNTS=${JSON.stringify({
      admin: admins.length,
      superadmin: superadmins.length,
      legacyElevated: legacyElevated.length,
    })}`,
  )
  console.log(
    `PRIVILEGE_AUDIT_ROOT_IDENTITY=${JSON.stringify(safeRootIdentities)}`,
  )
  console.log(`PRIVILEGE_AUDIT_INVARIANT=${invariantPass ? 'PASS' : 'FAIL'}`)

  if (!invariantPass) {
    process.exitCode = 42
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`PRIVILEGE_AUDIT_ERROR=${message}`)
    process.exitCode = 43
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

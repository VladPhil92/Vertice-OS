import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

type ElevatedGrantRow = {
  citizen_id: string
  role: 'admin' | 'superadmin'
  source: string
  granted_by_citizen_id: string | null
  granted_at: Date
  revoked_at: Date | null
}

type RootIdentityRow = {
  citizen_id: string
  provider: string
  provider_subject: string
}

type CountRow = {
  count: bigint
}

// Canonical root authority is anchored to the pinned CTG One subject without
// storing or logging a human-readable operator identity in repository code.
const ROOT_SUBJECT_SHA256 = '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08'
const prisma = new PrismaClient()

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function auditRef(value: string | null): string | null {
  return value ? sha256(value).slice(0, 16) : null
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<ElevatedGrantRow[]>(`
    SELECT
      g.citizen_id::text AS citizen_id,
      g.role,
      g.source,
      g.granted_by_citizen_id::text AS granted_by_citizen_id,
      g.granted_at,
      g.revoked_at
    FROM citizen_role_grants g
    WHERE g.revoked_at IS NULL
      AND g.role IN ('admin', 'superadmin')
    ORDER BY g.role ASC, g.citizen_id ASC
  `)

  const [citizenCountRow] = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*)::bigint AS count FROM citizens
  `)
  const citizenCount = Number(citizenCountRow?.count ?? 0n)

  const [allGrantCountRow] = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM citizen_role_grants
    WHERE revoked_at IS NULL
  `)
  const activeGrantCount = Number(allGrantCountRow?.count ?? 0n)

  const superadmins = rows.filter((row) => row.role === 'superadmin')
  const admins = rows.filter((row) => row.role === 'admin')
  const legacyElevated = rows.filter((row) =>
    ['legacy_role', 'legacy_backfill'].includes(row.source),
  )

  const rootIdentities = await prisma.$queryRawUnsafe<RootIdentityRow[]>(`
    SELECT
      ei.citizen_id::text AS citizen_id,
      ei.provider,
      ei.provider_subject
    FROM external_identities ei
    INNER JOIN citizen_role_grants g ON g.citizen_id = ei.citizen_id
    WHERE g.revoked_at IS NULL
      AND g.role = 'superadmin'
      AND ei.provider = 'ctg_one'
    ORDER BY ei.created_at ASC
  `)

  const canonicalRootCitizenIds = new Set(
    rootIdentities
      .filter((identity) => sha256(identity.provider_subject) === ROOT_SUBJECT_SHA256)
      .map((identity) => identity.citizen_id),
  )
  const canonicalRoots = superadmins.filter((row) => canonicalRootCitizenIds.has(row.citizen_id))

  // Runtime privilege evidence is deliberately privacy-minimized. Raw citizen
  // UUIDs and provider subjects are used only in-memory to evaluate the
  // invariant and are never written to deploy logs.
  const safeRows = rows.map((row) => ({
    citizen_ref: auditRef(row.citizen_id),
    role: row.role,
    source: row.source,
    grantor_ref: auditRef(row.granted_by_citizen_id),
    granted_at: row.granted_at.toISOString(),
    revoked_at: row.revoked_at?.toISOString() ?? null,
  }))
  const safeRootIdentities = rootIdentities.map((identity) => ({
    citizen_ref: auditRef(identity.citizen_id),
    provider: identity.provider,
    provider_subject_sha256: sha256(identity.provider_subject),
  }))

  const canonicalRootGrant = canonicalRoots.length === 1
    && canonicalRoots[0].source === 'ctg_one_bootstrap'
    && canonicalRoots[0].granted_by_citizen_id === null
  const canonicalRootIdentity = canonicalRoots.length === 1
    && safeRootIdentities.some(
      (identity) => identity.citizen_ref === auditRef(canonicalRoots[0].citizen_id)
        && identity.provider === 'ctg_one'
        && identity.provider_subject_sha256 === ROOT_SUBJECT_SHA256,
    )

  // Fresh installations have no citizen identities yet. They are safe to boot
  // only when they also have no active grants at all; the canonical root will
  // be established later through the pinned CTG One bootstrap flow.
  const prebootstrapEmpty = citizenCount === 0 && activeGrantCount === 0

  const canonicalProduction =
    citizenCount > 0 &&
    superadmins.length === 1 &&
    canonicalRoots.length === 1 &&
    canonicalRootGrant &&
    canonicalRootIdentity &&
    admins.length === 0 &&
    legacyElevated.length === 0

  const invariantPass = prebootstrapEmpty || canonicalProduction
  const mode = prebootstrapEmpty ? 'PREBOOTSTRAP_EMPTY' : 'CANONICAL_ROOT'

  console.log(`PRIVILEGE_AUDIT_ROWS=${JSON.stringify(safeRows)}`)
  console.log(
    `PRIVILEGE_AUDIT_COUNTS=${JSON.stringify({
      citizens: citizenCount,
      activeGrants: activeGrantCount,
      admin: admins.length,
      superadmin: superadmins.length,
      legacyElevated: legacyElevated.length,
      canonicalRootGrant: canonicalRootGrant ? 1 : 0,
      canonicalRootIdentity: canonicalRootIdentity ? 1 : 0,
    })}`,
  )
  console.log(
    `PRIVILEGE_AUDIT_ROOT_IDENTITY=${JSON.stringify(safeRootIdentities)}`,
  )
  console.log(`PRIVILEGE_AUDIT_MODE=${mode}`)
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

import { spawnSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const MIGRATION_NAME = '20260907210000_privilege_provenance_hardening'
const PRISMA_BIN = './apps/api/node_modules/.bin/prisma'
const SCHEMA_PATH = 'apps/api/prisma/schema.prisma'

const prisma = new PrismaClient()

async function unresolvedAttemptCount(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ unresolved: bigint }>>(
    `SELECT COUNT(*)::bigint AS unresolved
       FROM "_prisma_migrations"
      WHERE migration_name = $1
        AND finished_at IS NULL
        AND rolled_back_at IS NULL`,
    MIGRATION_NAME,
  )
  return Number(rows[0]?.unresolved ?? 0n)
}

async function main(): Promise<void> {
  const unresolved = await unresolvedAttemptCount()

  if (unresolved === 0) {
    console.log('PRIVILEGE_RECOVERY_STATE=SKIP_NO_FAILED_ATTEMPT')
    return
  }

  if (unresolved !== 1) {
    throw new Error(`PRIVILEGE_RECOVERY_UNEXPECTED_FAILED_ATTEMPTS=${unresolved}`)
  }

  console.log(`PRIVILEGE_RECOVERY_STATE=RESOLVING_ROLLED_BACK:${MIGRATION_NAME}`)
  await prisma.$disconnect()

  const result = spawnSync(
    PRISMA_BIN,
    [
      'migrate',
      'resolve',
      '--rolled-back',
      MIGRATION_NAME,
      '--schema',
      SCHEMA_PATH,
    ],
    { stdio: 'inherit' },
  )

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`PRIVILEGE_RECOVERY_RESOLVE_EXIT=${String(result.status)}`)
  }

  console.log('PRIVILEGE_RECOVERY_STATE=ROLLED_BACK_MARKED')
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`PRIVILEGE_RECOVERY_ERROR=${message}`)
    process.exitCode = 44
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

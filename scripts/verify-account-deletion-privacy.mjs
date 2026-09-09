import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function requireText(file, text) {
  if (!file.includes(text)) {
    throw new Error(`Account deletion privacy contract missing: ${text}`)
  }
}

const migration = read('apps/api/prisma/migrations/20260909184500_account_deletion_privacy_phase/migration.sql')
const service = read('apps/api/src/modules/auth/account-deletion.service.ts')
const routes = read('apps/api/src/modules/auth/auth.routes.ts')
const jobs = read('apps/api/src/lib/jobs.ts')
const media = read('apps/api/src/modules/media/media-provider.ts')
const mobileAuth = read('apps/mobile/providers/AuthProvider.tsx')
const mobileProfile = read('apps/mobile/app/(tabs)/profile.tsx')
const mobileDeletion = read('apps/mobile/app/account-deletion.tsx')
const webDeletion = read('apps/web/app/dashboard/privacy/page.tsx')
const publicDeletion = read('apps/web/app/account-deletion/page.tsx')

for (const text of [
  'CREATE TABLE IF NOT EXISTS account_deletion_requests',
  'retention_policy_version',
  'retained_categories',
  "CHECK (request_source IN ('web', 'mobile', 'api'))",
]) requireText(migration, text)

for (const forbidden of ['email ', 'cedula_hash', 'password_hash', 'provider_subject']) {
  const createTable = migration.slice(
    migration.indexOf('CREATE TABLE IF NOT EXISTS account_deletion_requests'),
    migration.indexOf(');', migration.indexOf('CREATE TABLE IF NOT EXISTS account_deletion_requests')) + 2,
  )
  if (createTable.includes(forbidden)) {
    throw new Error(`Deletion receipt must remain PII-free: ${forbidden}`)
  }
}

for (const text of [
  'pg_advisory_xact_lock',
  's.revoked_at IS NULL',
  's.expires_at > NOW()',
  "g.source = 'ctg_one_bootstrap'",
  'ACCOUNT_DELETION_REAUTH_REQUIRED',
  'ROOT_ACCOUNT_DELETION_PROTECTED',
  'ACCOUNT_DELETION_AUTHORITY_TRANSFER_REQUIRED',
  'DELETE FROM mobile_push_devices',
  'DELETE FROM external_identities',
  'DELETE FROM civic_identity_proof_events',
  'DELETE FROM civic_identity_proofs',
  'DELETE FROM civic_profile_follows',
  'DELETE FROM scheduled_civic_publications',
  'UPDATE territorial_reports SET citizen_id = NULL',
  'UPDATE proposals SET author_id = NULL',
  'email = NULL',
  'cedula_hash = NULL',
  'password_hash = NULL',
  'public_civic_profile = FALSE',
  'is_active = FALSE',
  "'purge_deleted_identity_auxiliary'",
  'INSERT INTO account_deletion_requests',
]) requireText(service, text)

for (const text of [
  "app.delete('/account'",
  "confirmation: z.literal('ELIMINAR')",
  'request.citizen.sid',
  'deleteCitizenAccount(',
  "reply.clearCookie(REFRESH_COOKIE, { path: '/auth' })",
]) requireText(routes, text)

for (const text of [
  "'purge_deleted_identity_auxiliary'",
  'purgeImageAssetStrict',
  'redis.del(`vertice:notif:${payload.citizenId}`)',
  "MATCH (c:Citizen {id: $id}) DETACH DELETE c",
]) requireText(jobs, text)
requireText(media, 'export async function purgeImageAssetStrict')
requireText(media, "code: 'MEDIA_PROVIDER_DELETE_FAILED'")

for (const text of [
  'deleteAccount: () => Promise<AccountDeletionReceipt>',
  "apiFetch<AccountDeletionReceipt>('/auth/account'",
  "confirmation: 'ELIMINAR', source: 'mobile'",
  'await clearSessionTokens()',
  'setUser(null)',
]) requireText(mobileAuth, text)
requireText(mobileProfile, "router.push('/account-deletion')")
for (const text of [
  "const REQUIRED_CONFIRMATION = 'ELIMINAR'",
  'Eliminar mi cuenta',
  'deleteAccount()',
  'Eliminar definitivamente',
]) requireText(mobileDeletion, text)

for (const text of [
  "apiFetch<AccountDeletionReceipt>('/auth/account'",
  "confirmation: REQUIRED_CONFIRMATION, source: 'web'",
  "localStorage.removeItem('access_token')",
  'Eliminar mi cuenta',
]) requireText(webDeletion, text)
for (const text of [
  'Eliminar tu cuenta de VÉRTICE',
  '/auth/login?next=/dashboard/privacy',
  'No necesitas contactar soporte',
]) requireText(publicDeletion, text)

console.log('Account deletion privacy source contract: PASS')

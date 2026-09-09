import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'

import { delCache } from '../../lib/cache'
import { prisma } from '../../lib/prisma'
import { prepareRecurringBillingForAccountDeletion } from '../billing/account-deletion-billing.service'

const SUPERADMIN_AUTHORITY_LOCK = 'vertice-superadmin-authority'
const RETENTION_POLICY_VERSION = '2026-09-09.v1'

export const ACCOUNT_DELETION_RETAINED_CATEGORIES = [
  'civic_records_pseudonymized',
  'financial_records_required_for_accounting_or_disputes',
  'security_and_audit_records_pseudonymized',
] as const

export type AccountDeletionSource = 'web' | 'mobile' | 'api'

export interface AccountDeletionReceipt {
  request_id: string
  status: 'completed'
  completed_at: string
  retention_policy_version: string
  retained_categories: readonly string[]
  auxiliary_cleanup_queued: boolean
}

type AccountState = {
  id: string
  is_active: boolean
  live_session: boolean
  canonical_root: boolean
  has_active_privilege_descendants: boolean
  has_open_payout: boolean
}

type AvatarAsset = {
  id: string
  provider_asset_id: string
}

function deletionError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function validateDeletionState(account: AccountState | undefined): asserts account is AccountState {
  if (!account) {
    throw deletionError('La cuenta no existe.', 404, 'ACCOUNT_NOT_FOUND')
  }
  if (!account.is_active) {
    throw deletionError('La cuenta ya fue eliminada.', 410, 'ACCOUNT_ALREADY_DELETED')
  }
  if (!account.live_session) {
    throw deletionError(
      'Vuelve a iniciar sesión antes de eliminar tu cuenta.',
      401,
      'ACCOUNT_DELETION_REAUTH_REQUIRED',
    )
  }
  if (account.canonical_root) {
    throw deletionError(
      'La autoridad raíz de VÉRTICE no puede eliminarse desde el autoservicio de cuenta.',
      409,
      'ROOT_ACCOUNT_DELETION_PROTECTED',
    )
  }
  if (account.has_active_privilege_descendants) {
    throw deletionError(
      'Transfiere o revoca primero las delegaciones administrativas activas emitidas por esta cuenta.',
      409,
      'ACCOUNT_DELETION_AUTHORITY_TRANSFER_REQUIRED',
    )
  }
  if (account.has_open_payout) {
    throw deletionError(
      'Existe un desembolso en curso que debe completarse o conciliarse antes de eliminar la identidad beneficiaria.',
      409,
      'ACCOUNT_DELETION_PAYOUT_RECONCILIATION_REQUIRED',
    )
  }
}

async function preflightDeletion(citizenId: string, sessionId: string): Promise<void> {
  const rows = await prisma.$queryRaw<AccountState[]>(Prisma.sql`
    SELECT
      c.id::text AS id,
      c.is_active,
      EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = ${sessionId}::uuid
          AND s.citizen_id = c.id
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
      ) AS live_session,
      EXISTS (
        SELECT 1 FROM citizen_role_grants g
        WHERE g.citizen_id = c.id
          AND g.role = 'superadmin'
          AND g.source = 'ctg_one_bootstrap'
          AND g.revoked_at IS NULL
      ) AS canonical_root,
      EXISTS (
        SELECT 1 FROM citizen_role_grants child
        WHERE child.granted_by_citizen_id = c.id
          AND child.role IN ('moderator', 'admin', 'superadmin')
          AND child.revoked_at IS NULL
      ) AS has_active_privilege_descendants,
      EXISTS (
        SELECT 1 FROM crowdfunding_payout_requests p
        WHERE (p.beneficiary_citizen_id = c.id OR p.requested_by_citizen_id = c.id)
          AND p.status IN ('requested', 'pending_approval', 'processing', 'reconciliation_required')
      ) AS has_open_payout
    FROM citizens c
    WHERE c.id = ${citizenId}::uuid
    LIMIT 1
  `)
  validateDeletionState(rows[0])
}

/**
 * Irreversibly erases a citizen's account identity while preserving only the
 * pseudonymised civic/financial/audit anchors required for integrity.
 *
 * Important invariants:
 * - A current, non-revoked server-side session is required.
 * - External recurring billing mandates are cancelled before identity erasure.
 * - Open payout lifecycles block erasure until reconciliation is complete.
 * - Delegated voting/social influence is revoked in the erasure transaction.
 * - This is not a reversible account suspension.
 * - Direct identifiers and credentials are removed in the same transaction.
 * - Public social/publishing surfaces are removed or made non-public.
 * - Historical civic/financial records are not rewritten to fabricate history.
 * - The canonical root account cannot self-delete.
 * - A Superadmin that still anchors active delegated authority must transfer or
 *   revoke that authority first; deleting it would otherwise orphan trust lineage.
 */
export async function deleteCitizenAccount(
  citizenId: string,
  sessionId: string,
  source: AccountDeletionSource,
): Promise<AccountDeletionReceipt> {
  await preflightDeletion(citizenId, sessionId)
  await prepareRecurringBillingForAccountDeletion(citizenId)

  const requestId = crypto.randomUUID()
  const pseudonymousDid = `did:vertice:deleted:${crypto.randomUUID()}`
  const retainedCategories = [...ACCOUNT_DELETION_RETAINED_CATEGORIES]

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ lock_result: string | null }>>(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtext(${SUPERADMIN_AUTHORITY_LOCK}))::text AS lock_result
    `)

    const rows = await tx.$queryRaw<AccountState[]>(Prisma.sql`
      SELECT
        c.id::text AS id,
        c.is_active,
        EXISTS (
          SELECT 1 FROM sessions s
          WHERE s.id = ${sessionId}::uuid
            AND s.citizen_id = c.id
            AND s.revoked_at IS NULL
            AND s.expires_at > NOW()
        ) AS live_session,
        EXISTS (
          SELECT 1 FROM citizen_role_grants g
          WHERE g.citizen_id = c.id
            AND g.role = 'superadmin'
            AND g.source = 'ctg_one_bootstrap'
            AND g.revoked_at IS NULL
        ) AS canonical_root,
        EXISTS (
          SELECT 1 FROM citizen_role_grants child
          WHERE child.granted_by_citizen_id = c.id
            AND child.role IN ('moderator', 'admin', 'superadmin')
            AND child.revoked_at IS NULL
        ) AS has_active_privilege_descendants,
        EXISTS (
          SELECT 1 FROM crowdfunding_payout_requests p
          WHERE (p.beneficiary_citizen_id = c.id OR p.requested_by_citizen_id = c.id)
            AND p.status IN ('requested', 'pending_approval', 'processing', 'reconciliation_required')
        ) AS has_open_payout
      FROM citizens c
      WHERE c.id = ${citizenId}::uuid
      LIMIT 1
      FOR UPDATE
    `)
    validateDeletionState(rows[0])

    const avatarAssets = await tx.$queryRaw<AvatarAsset[]>(Prisma.sql`
      SELECT id::text, provider_asset_id
      FROM media_assets
      WHERE owner_citizen_id = ${citizenId}::uuid
        AND purpose = 'civic_profile_avatar'
        AND status <> 'deleted'
      FOR UPDATE
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE sessions
      SET revoked_at = COALESCE(revoked_at, NOW()), active_role = 'citizen'
      WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE citizen_role_grants
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE delegations
      SET is_active = FALSE, revoked_at = COALESCE(revoked_at, NOW())
      WHERE (delegator_id = ${citizenId}::uuid OR delegate_id = ${citizenId}::uuid)
        AND is_active = TRUE
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM mobile_push_devices WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM external_identities WHERE citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_identity_proof_events WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_identity_proofs WHERE citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_profile_follows
      WHERE follower_id = ${citizenId}::uuid OR followed_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM territory_activation_interests WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_activity_validations WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_action_validations WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_action_collaborators WHERE citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      DELETE FROM civic_activity_validations v
      USING scheduled_civic_publications p
      WHERE v.activity_type = 'publication'
        AND v.activity_id = p.id
        AND p.citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM jobs j
      USING scheduled_civic_publications p
      WHERE j.type = 'publish_civic_update'
        AND j.payload->>'publicationId' = p.id::text
        AND p.citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM scheduled_civic_publications WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM legal_documents WHERE citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE territorial_reports SET citizen_id = NULL
      WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE proposals SET author_id = NULL
      WHERE author_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      WITH target AS (
        SELECT id, revision_no, status AS from_status, compliance_status AS from_compliance_status
        FROM crowdfunding_campaigns
        WHERE creator_citizen_id = ${citizenId}::uuid
          AND status NOT IN ('completed', 'suspended', 'investigation')
        FOR UPDATE
      ), changed AS (
        UPDATE crowdfunding_campaigns c
        SET status = 'suspended', compliance_status = 'suspended', updated_at = NOW()
        FROM target t
        WHERE c.id = t.id
        RETURNING c.id, c.revision_no, t.from_status, t.from_compliance_status
      )
      INSERT INTO crowdfunding_campaign_lifecycle_events (
        campaign_id, actor_citizen_id, event_type, revision_no,
        from_status, to_status, from_compliance_status, to_compliance_status,
        notes
      )
      SELECT id, NULL, 'suspended', revision_no,
             from_status, 'suspended', from_compliance_status, 'suspended',
             'Automatic suspension after creator account deletion.'
      FROM changed
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM crowdfunding_updates WHERE author_citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE crowdfunding_contributions SET contributor_citizen_id = NULL
      WHERE contributor_citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE payment_transactions
      SET status = 'cancelled', updated_at = NOW()
      WHERE citizen_id = ${citizenId}::uuid
        AND kind = 'subscription'
        AND status IN ('pending', 'authorized')
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM subscriptions WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM billing_usage_counters WHERE citizen_id = ${citizenId}::uuid
    `)
    await tx.$executeRaw(Prisma.sql`
      UPDATE payment_transactions SET citizen_id = NULL
      WHERE citizen_id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE media_assets
      SET
        provider_asset_id = 'deleted-' || id::text,
        status = 'deleted',
        public_url = NULL,
        deleted_at = NOW()
      WHERE owner_citizen_id = ${citizenId}::uuid
        AND purpose = 'civic_profile_avatar'
        AND status <> 'deleted'
    `)

    await tx.$executeRaw(Prisma.sql`
      UPDATE citizens
      SET
        did = ${pseudonymousDid},
        cedula_hash = NULL,
        email = NULL,
        password_hash = NULL,
        locality_id = NULL,
        neighborhood = NULL,
        display_name = NULL,
        verification_level = 0,
        reputation_score = 0,
        participation_count = 0,
        is_active = FALSE,
        role = 'citizen',
        wallet_address = NULL,
        sbt_token_id = NULL,
        last_active_at = NULL,
        civic_profile_type = 'citizen',
        civic_bio = NULL,
        civic_organization = NULL,
        public_civic_profile = FALSE,
        civic_avatar_asset_id = NULL,
        civic_avatar_pending_asset_id = NULL,
        civic_avatar_url = NULL,
        civic_avatar_status = 'missing',
        civic_avatar_policy_attested_at = NULL,
        civic_avatar_updated_at = NOW(),
        territory_code = NULL,
        territory_assurance_level = 0,
        territory_assurance_source = 'deleted',
        territory_verified_at = NULL
      WHERE id = ${citizenId}::uuid
    `)

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO account_deletion_requests (
        id,
        citizen_id,
        status,
        request_source,
        retention_policy_version,
        retained_categories,
        requested_at,
        completed_at
      ) VALUES (
        ${requestId}::uuid,
        ${citizenId}::uuid,
        'completed',
        ${source},
        ${RETENTION_POLICY_VERSION},
        ${JSON.stringify(retainedCategories)}::jsonb,
        NOW(),
        NOW()
      )
    `)

    if (avatarAssets.length > 0) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO jobs (type, payload, run_after)
        VALUES (
          'purge_deleted_identity_auxiliary',
          ${JSON.stringify({
            citizenId,
            avatarAssetIds: avatarAssets.map((asset) => asset.provider_asset_id),
          })}::jsonb,
          NOW()
        )
      `)
    }

    const [receipt] = await tx.$queryRaw<Array<{ completed_at: Date }>>(Prisma.sql`
      SELECT completed_at
      FROM account_deletion_requests
      WHERE id = ${requestId}::uuid
      LIMIT 1
    `)

    return {
      completedAt: receipt?.completed_at ?? new Date(),
      auxiliaryCleanupQueued: avatarAssets.length > 0,
    }
  })

  await delCache('profile', citizenId).catch(() => undefined)

  return {
    request_id: requestId,
    status: 'completed',
    completed_at: result.completedAt.toISOString(),
    retention_policy_version: RETENTION_POLICY_VERSION,
    retained_categories: retainedCategories,
    auxiliary_cleanup_queued: result.auxiliaryCleanupQueued,
  }
}

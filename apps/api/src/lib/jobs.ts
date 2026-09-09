import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { config } from '../config'
import { logger } from './logger'
import { redis } from './redis'
import { delCache } from './cache'
import { runCypher } from './neo4j'
import {
  mintCitizenBadge,
  buildCitizenBadgeURI,
  recordProposalVoting,
  buildProposalContentHash,
} from './blockchain'
import { reconcileFinanceLedger } from '../modules/billing/finance-operations.service'
import { reconcileCampaignPayout } from '../modules/billing/crowdfunding-payout.service'
import { publishScheduledCivicPublication } from '../modules/publishing/publishing.service'
import { purgeImageAssetStrict } from '../modules/media/media-provider'

export type JobType =
  | 'mint_identity_badge'
  | 'record_voting_result'
  | 'reconcile_payment_ledger'
  | 'reconcile_crowdfunding_payout'
  | 'publish_civic_update'
  | 'purge_deleted_identity_auxiliary'

export interface MintIdentityBadgePayload {
  citizenId: string
  did: string
  walletAddress: string
}

export interface RecordVotingResultPayload {
  proposalId: string
  title: string
  description: string
  totalVotes: number
  approveWeighted: number
  rejectWeighted: number
  abstainWeighted: number
  result: 'approved' | 'rejected' | 'quorum_failed'
  ipfsResultUri: string | null
}

export interface ReconcilePaymentLedgerPayload {
  requestedByCitizenId?: string | null
}

export interface ReconcileCrowdfundingPayoutPayload {
  payoutRequestId: string
  requestedByCitizenId?: string | null
}

export interface PublishCivicUpdatePayload {
  publicationId: string
}

export interface PurgeDeletedIdentityAuxiliaryPayload {
  citizenId: string
  avatarAssetIds: string[]
}

type JobPayload =
  | MintIdentityBadgePayload
  | RecordVotingResultPayload
  | ReconcilePaymentLedgerPayload
  | ReconcileCrowdfundingPayoutPayload
  | PublishCivicUpdatePayload
  | PurgeDeletedIdentityAuxiliaryPayload

interface JobRow {
  id: number
  type: JobType
  payload: JobPayload
  attempts: number
  max_attempts: number
}

interface SqlRunner {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>
}

export async function enqueueJob(
  type: JobType,
  payload: JobPayload,
  client: SqlRunner = prisma,
): Promise<void> {
  await client.$queryRaw(Prisma.sql`
    INSERT INTO jobs (type, payload) VALUES (${type}, ${JSON.stringify(payload)}::jsonb)
  `)
}

export async function claimNextJob(): Promise<JobRow | null> {
  const rows = await prisma.$queryRaw<JobRow[]>(Prisma.sql`
    UPDATE jobs
    SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_after <= NOW()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts, max_attempts
  `)
  return rows[0] ?? null
}

async function completeJob(id: number): Promise<void> {
  await prisma.$queryRaw(Prisma.sql`
    UPDATE jobs SET status = 'succeeded', updated_at = NOW() WHERE id = ${id}
  `)
}

async function failJob(id: number, attempts: number, maxAttempts: number, error: string): Promise<void> {
  const message = error.slice(0, 2000)

  if (attempts >= maxAttempts) {
    await prisma.$queryRaw(Prisma.sql`
      UPDATE jobs SET status = 'failed', last_error = ${message}, updated_at = NOW() WHERE id = ${id}
    `)
    logger.error(`[jobs] job ${id} agotó ${attempts} intentos, marcado failed: ${message}`)
    return
  }

  const backoffSeconds = Math.min(300, 2 ** attempts)
  await prisma.$queryRaw(Prisma.sql`
    UPDATE jobs
    SET status = 'pending',
        last_error = ${message},
        run_after = NOW() + (${backoffSeconds} || ' seconds')::interval,
        updated_at = NOW()
    WHERE id = ${id}
  `)
  logger.error(`[jobs] job ${id} falló (intento ${attempts}/${maxAttempts}), reintenta en ${backoffSeconds}s: ${message}`)
}

async function handleMintIdentityBadge(payload: MintIdentityBadgePayload): Promise<void> {
  const tokenURI = buildCitizenBadgeURI(payload.did, 2)
  const tokenId = await mintCitizenBadge(payload.walletAddress, payload.did, tokenURI)

  if (tokenId !== null) {
    await prisma.citizen.update({
      where: { id: payload.citizenId },
      data: { sbtTokenId: tokenId },
    })
  }
}

async function handleRecordVotingResult(payload: RecordVotingResultPayload): Promise<void> {
  const contentHash = buildProposalContentHash(payload.title, payload.description)
  const approved = payload.result === 'approved'
  const quorumReached = payload.result !== 'quorum_failed'
  const ipfsURI = payload.ipfsResultUri
    ?? `${config.IPFS_GATEWAY}/QmVerticeResult?proposal=${encodeURIComponent(payload.proposalId)}`

  const txHash = await recordProposalVoting(
    payload.proposalId,
    contentHash,
    payload.totalVotes,
    payload.approveWeighted,
    payload.rejectWeighted,
    payload.abstainWeighted,
    approved,
    quorumReached,
    ipfsURI,
  )

  if (txHash) {
    await prisma.proposal.update({
      where: { id: payload.proposalId },
      data: { blockchainTxHash: txHash },
    })
  }
}

async function handlePaymentLedgerReconciliation(payload: ReconcilePaymentLedgerPayload): Promise<void> {
  const result = await reconcileFinanceLedger({
    actorId: payload.requestedByCitizenId ?? null,
    triggerKind: 'job',
    limit: 100,
  })
  if (result.status === 'failed') {
    throw new Error(`payment reconciliation run ${result.id} failed (${result.failed}/${result.scanned})`)
  }
}

async function handleCrowdfundingPayoutReconciliation(payload: ReconcileCrowdfundingPayoutPayload): Promise<void> {
  await reconcileCampaignPayout({
    payoutRequestId: payload.payoutRequestId,
    actorId: payload.requestedByCitizenId ?? null,
  })
}

async function handlePublishCivicUpdate(payload: PublishCivicUpdatePayload): Promise<void> {
  await publishScheduledCivicPublication(payload.publicationId)
}

async function handleDeletedIdentityAuxiliaryPurge(
  payload: PurgeDeletedIdentityAuxiliaryPayload,
): Promise<void> {
  for (const assetId of payload.avatarAssetIds) {
    await purgeImageAssetStrict(assetId)
  }

  // Notifications and profile cache are non-authoritative but can contain
  // display data. They are deleted as part of the durable retryable purge.
  await Promise.all([
    redis.del(`vertice:notif:${payload.citizenId}`),
    delCache('profile', payload.citizenId),
  ])

  // Neo4j is a derived graph projection. Removing the node prevents the old DID
  // from surviving account erasure in a secondary store.
  await runCypher(
    'MATCH (c:Citizen {id: $id}) DETACH DELETE c',
    { id: payload.citizenId },
  )
}

export async function runJob(job: JobRow): Promise<void> {
  try {
    switch (job.type) {
      case 'mint_identity_badge':
        await handleMintIdentityBadge(job.payload as MintIdentityBadgePayload)
        break
      case 'record_voting_result':
        await handleRecordVotingResult(job.payload as RecordVotingResultPayload)
        break
      case 'reconcile_payment_ledger':
        await handlePaymentLedgerReconciliation(job.payload as ReconcilePaymentLedgerPayload)
        break
      case 'reconcile_crowdfunding_payout':
        await handleCrowdfundingPayoutReconciliation(job.payload as ReconcileCrowdfundingPayoutPayload)
        break
      case 'publish_civic_update':
        await handlePublishCivicUpdate(job.payload as PublishCivicUpdatePayload)
        break
      case 'purge_deleted_identity_auxiliary':
        await handleDeletedIdentityAuxiliaryPurge(job.payload as PurgeDeletedIdentityAuxiliaryPayload)
        break
    }
    await completeJob(job.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failJob(job.id, job.attempts, job.max_attempts, message)
  }
}

let stopped = true

export function startJobWorker(intervalMs = 5000): () => void {
  stopped = false

  async function tick(): Promise<void> {
    if (stopped) return
    try {
      const job = await claimNextJob()
      if (job) {
        await runJob(job)
        if (!stopped) setImmediate(() => { tick().catch((err: unknown) => logger.error('[jobs] worker tick failed', err)) })
        return
      }
    } catch (err) {
      logger.error('[jobs] worker tick failed', err)
    }
    if (!stopped) setTimeout(() => { tick().catch((err: unknown) => logger.error('[jobs] worker tick failed', err)) }, intervalMs)
  }

  tick().catch((err: unknown) => logger.error('[jobs] worker crashed on boot', err))

  return () => { stopped = true }
}

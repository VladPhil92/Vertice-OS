import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { config } from '../config'
import { logger } from './logger'
import {
  mintCitizenBadge,
  buildCitizenBadgeURI,
  recordProposalVoting,
  buildProposalContentHash,
} from './blockchain'

// Cola durable en Postgres. Reemplaza el patrón "enviar y olvidar"
// (`.catch(() => null)`) para las dos operaciones que antes fallaban en
// silencio si el proceso caía a mitad de camino: emisión de badges SBT y
// registro de resultados de votación en VotingRegistry. Un worker en el
// mismo proceso de la API reclama trabajos con `FOR UPDATE SKIP LOCKED` y
// reintenta con backoff exponencial hasta `max_attempts` antes de marcarlos
// 'failed' — no requiere infraestructura adicional (Redis Streams, SQS, etc.),
// solo la base de datos que ya existe.

export type JobType = 'mint_identity_badge' | 'record_voting_result'

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

type JobPayload = MintIdentityBadgePayload | RecordVotingResultPayload

interface JobRow {
  id: number
  type: JobType
  payload: JobPayload
  attempts: number
  max_attempts: number
}

// Subconjunto de PrismaClient que también implementa Prisma.TransactionClient
// — permite encolar un job dentro de la misma transacción que el cambio de
// estado que lo origina, sin acoplar este módulo al tipo completo del cliente.
interface SqlRunner {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>
}

/**
 * Encola un trabajo. Si se pasa `client` (un `tx` de `prisma.$transaction`),
 * el INSERT participa de esa transacción: si el resto de la transacción hace
 * rollback, el job nunca llega a existir — evita el caso en que el estado
 * cambia pero el trabajo que debía dispararse se pierde porque el proceso
 * cayó justo entre ambas operaciones.
 */
export async function enqueueJob(
  type: JobType,
  payload: JobPayload,
  client: SqlRunner = prisma,
): Promise<void> {
  await client.$queryRaw(Prisma.sql`
    INSERT INTO jobs (type, payload) VALUES (${type}, ${JSON.stringify(payload)}::jsonb)
  `)
}

// Exportada además de usarse internamente por startJobWorker(): permite a los
// tests ejercitar reclamo/ejecución/backoff sin depender de temporizadores
// reales.
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

// ── Handlers ────────────────────────────────────────────────────────────────

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

export async function runJob(job: JobRow): Promise<void> {
  try {
    // El payload llega como JSONB crudo desde Postgres — su forma real solo
    // está garantizada por lo que enqueueJob() escribió para cada JobType, de
    // ahí el cast explícito en vez de un mapa de handlers tipado con `any`.
    switch (job.type) {
      case 'mint_identity_badge':
        await handleMintIdentityBadge(job.payload as MintIdentityBadgePayload)
        break
      case 'record_voting_result':
        await handleRecordVotingResult(job.payload as RecordVotingResultPayload)
        break
    }
    await completeJob(job.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failJob(job.id, job.attempts, job.max_attempts, message)
  }
}

// ── Worker ─────────────────────────────────────────────────────────────────

let stopped = true

/**
 * Arranca un poller en el mismo proceso de la API. No hace falta un worker
 * separado ni infraestructura adicional para el volumen esperado en el
 * piloto — si el volumen crece, el mismo esquema de tabla sirve para mover
 * el consumo a un proceso dedicado sin cambiar el contrato de enqueueJob().
 */
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

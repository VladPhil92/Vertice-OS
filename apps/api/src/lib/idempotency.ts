import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

const CLIENT_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/
const EXPLICIT_TTL_MS = 24 * 60 * 60 * 1000
const DERIVED_TTL_MS = 15 * 60 * 1000

type ReceiptState = 'processing' | 'completed' | 'failed'
type KeySource = 'client' | 'derived'

type ReceiptRow = {
  id: string
  request_hash: string
  state: ReceiptState
  response_status: number | null
  response_body: unknown
  failure_code: string | null
  expires_at: Date
}

export interface IdempotentMutationResult<T> {
  value: T
  statusCode: number
  replayed: boolean
  idempotencyKey: string
  keySource: KeySource
}

export interface IdempotentMutationOptions<T> {
  citizenId: string
  scope: string
  payload: unknown
  requestedKey?: string
  successStatus?: number
  operation: (effectiveKey: string) => Promise<T>
}

function makeError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)

  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalize(record[key])]),
  )
}

export function requestFingerprint(scope: string, payload: unknown): string {
  const canonical = JSON.stringify(canonicalize(payload))
  return createHash('sha256').update(`${scope}:${canonical}`).digest('hex')
}

export function normalizeRequestedIdempotencyKey(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const key = raw?.trim()
  if (!key) return undefined
  if (!CLIENT_KEY_PATTERN.test(key)) {
    throw makeError('Idempotency-Key inválido.', 400, 'INVALID_IDEMPOTENCY_KEY')
  }
  return key
}

function effectiveKey(scope: string, payload: unknown, requestedKey?: string) {
  const hash = requestFingerprint(scope, payload)
  if (requestedKey) {
    if (!CLIENT_KEY_PATTERN.test(requestedKey)) {
      throw makeError('Idempotency-Key inválido.', 400, 'INVALID_IDEMPOTENCY_KEY')
    }
    return {
      key: requestedKey,
      hash,
      source: 'client' as const,
      expiresAt: new Date(Date.now() + EXPLICIT_TTL_MS),
    }
  }

  return {
    key: `auto:${hash.slice(0, 48)}`,
    hash,
    source: 'derived' as const,
    expiresAt: new Date(Date.now() + DERIVED_TTL_MS),
  }
}

async function loadReceipt(citizenId: string, scope: string, key: string): Promise<ReceiptRow | null> {
  const rows = await prisma.$queryRaw<ReceiptRow[]>(Prisma.sql`
    SELECT
      id::text,
      request_hash,
      state,
      response_status,
      response_body,
      failure_code,
      expires_at
    FROM api_idempotency_receipts
    WHERE citizen_id = ${citizenId}::uuid
      AND scope = ${scope}
      AND idempotency_key = ${key}
    LIMIT 1
  `)
  return rows[0] ?? null
}

async function reserveReceipt(
  citizenId: string,
  scope: string,
  key: string,
  hash: string,
  source: KeySource,
  expiresAt: Date,
): Promise<boolean> {
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO api_idempotency_receipts (
      citizen_id,
      scope,
      idempotency_key,
      request_hash,
      key_source,
      state,
      expires_at
    ) VALUES (
      ${citizenId}::uuid,
      ${scope},
      ${key},
      ${hash},
      ${source},
      'processing',
      ${expiresAt}
    )
    ON CONFLICT (citizen_id, scope, idempotency_key) DO NOTHING
    RETURNING id::text
  `)
  return inserted.length > 0
}

async function deleteExpiredCompletedReceipt(citizenId: string, scope: string, key: string): Promise<boolean> {
  const deleted = await prisma.$executeRaw(Prisma.sql`
    DELETE FROM api_idempotency_receipts
    WHERE citizen_id = ${citizenId}::uuid
      AND scope = ${scope}
      AND idempotency_key = ${key}
      AND state = 'completed'
      AND expires_at <= NOW()
  `)
  return deleted > 0
}

async function completeReceipt(
  citizenId: string,
  scope: string,
  key: string,
  statusCode: number,
  value: unknown,
): Promise<void> {
  const responseJson = JSON.stringify(value === undefined ? null : value)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE api_idempotency_receipts
    SET state = 'completed',
        response_status = ${statusCode},
        response_body = ${responseJson}::jsonb,
        failure_code = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE citizen_id = ${citizenId}::uuid
      AND scope = ${scope}
      AND idempotency_key = ${key}
      AND state = 'processing'
  `)
}

async function failReceipt(
  citizenId: string,
  scope: string,
  key: string,
  error: unknown,
): Promise<void> {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'MUTATION_FAILED')
    : 'MUTATION_FAILED'

  await prisma.$executeRaw(Prisma.sql`
    UPDATE api_idempotency_receipts
    SET state = 'failed',
        failure_code = ${code.slice(0, 120)},
        updated_at = NOW()
    WHERE citizen_id = ${citizenId}::uuid
      AND scope = ${scope}
      AND idempotency_key = ${key}
      AND state = 'processing'
  `)
}

function replayExisting<T>(
  receipt: ReceiptRow,
  hash: string,
  key: string,
  source: KeySource,
): IdempotentMutationResult<T> {
  if (receipt.request_hash !== hash) {
    throw makeError(
      'La misma Idempotency-Key no puede reutilizarse con una operación diferente.',
      409,
      'IDEMPOTENCY_KEY_REUSED',
    )
  }

  if (receipt.state === 'completed') {
    return {
      value: receipt.response_body as T,
      statusCode: receipt.response_status ?? 200,
      replayed: true,
      idempotencyKey: key,
      keySource: source,
    }
  }

  if (receipt.state === 'processing') {
    throw makeError(
      'La operación todavía está en proceso. Reintenta con la misma clave en unos segundos.',
      409,
      'IDEMPOTENCY_IN_PROGRESS',
    )
  }

  throw makeError(
    'El resultado de la operación anterior es incierto. Inicia una nueva operación o concilia el estado antes de repetirla.',
    409,
    receipt.failure_code ? `IDEMPOTENCY_RECONCILIATION_REQUIRED:${receipt.failure_code}` : 'IDEMPOTENCY_RECONCILIATION_REQUIRED',
  )
}

/**
 * Durable at-most-once mutation boundary.
 *
 * If the caller supplies Idempotency-Key, the receipt is retained for 24h.
 * Otherwise a privacy-preserving key is derived from actor + scope + payload
 * and retained for 15 minutes, which protects browser retries/reloads without
 * requiring every current client to be upgraded in the same release.
 *
 * A crash after the domain mutation but before the receipt is committed leaves
 * the receipt in `processing`. Replays fail closed rather than executing again;
 * this is intentionally safer than pretending distributed exactly-once
 * semantics exist around external providers.
 */
export async function executeIdempotentMutation<T>(
  options: IdempotentMutationOptions<T>,
): Promise<IdempotentMutationResult<T>> {
  const scope = options.scope.trim()
  if (!scope || scope.length > 160) {
    throw makeError('Scope de idempotencia inválido.', 500, 'INVALID_IDEMPOTENCY_SCOPE')
  }

  const normalizedRequestedKey = options.requestedKey?.trim() || undefined
  const keyInfo = effectiveKey(scope, options.payload, normalizedRequestedKey)
  let reserved = await reserveReceipt(
    options.citizenId,
    scope,
    keyInfo.key,
    keyInfo.hash,
    keyInfo.source,
    keyInfo.expiresAt,
  )

  if (!reserved) {
    let existing = await loadReceipt(options.citizenId, scope, keyInfo.key)
    if (
      existing
      && existing.state === 'completed'
      && existing.expires_at.getTime() <= Date.now()
    ) {
      const removed = await deleteExpiredCompletedReceipt(options.citizenId, scope, keyInfo.key)
      if (removed) {
        reserved = await reserveReceipt(
          options.citizenId,
          scope,
          keyInfo.key,
          keyInfo.hash,
          keyInfo.source,
          keyInfo.expiresAt,
        )
        if (!reserved) existing = await loadReceipt(options.citizenId, scope, keyInfo.key)
      }
    }

    if (!reserved) {
      if (!existing) {
        throw makeError(
          'No fue posible determinar el estado de la operación. Reintenta más tarde.',
          409,
          'IDEMPOTENCY_STATE_UNAVAILABLE',
        )
      }
      return replayExisting<T>(existing, keyInfo.hash, keyInfo.key, keyInfo.source)
    }
  }

  let value: T
  try {
    value = await options.operation(keyInfo.key)
  } catch (error) {
    await failReceipt(options.citizenId, scope, keyInfo.key, error).catch(() => undefined)
    throw error
  }

  const successStatus = options.successStatus ?? 200
  try {
    await completeReceipt(options.citizenId, scope, keyInfo.key, successStatus, value)
  } catch {
    // The domain operation may already have committed. Keep the original
    // processing receipt intact so a replay fails closed instead of duplicating
    // a possibly-successful write.
    throw makeError(
      'La operación pudo completarse, pero no fue posible certificar su recibo. Verifica el estado antes de repetirla.',
      503,
      'IDEMPOTENCY_COMMIT_UNCERTAIN',
    )
  }

  return {
    value,
    statusCode: successStatus,
    replayed: false,
    idempotencyKey: keyInfo.key,
    keySource: keyInfo.source,
  }
}

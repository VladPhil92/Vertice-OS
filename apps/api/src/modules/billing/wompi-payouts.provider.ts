import { createHash, timingSafeEqual } from 'node:crypto'
import { config } from '../../config'

export type WompiPayoutConfigurationState = 'ready' | 'disabled' | 'misconfigured'

export type WompiPayoutBatchStatus =
  | 'PENDING_APPROVAL'
  | 'NOT_APPROVED'
  | 'REJECTED'
  | 'PENDING'
  | 'PARTIAL_PAYMENT'
  | 'TOTAL_PAYMENT'
  | 'CANCELLED'
  | string

export type WompiPayoutTransactionStatus = 'PENDING' | 'APPROVED' | 'CANCELLED' | 'FAILED' | 'REJECTED' | string

export type WompiBrebKeyType =
  | 'ALPHANUMERIC'
  | 'MAIL'
  | 'PHONE'
  | 'IDENTIFICATION'
  | 'ESTABLISHMENT_CODE'

export interface WompiPayoutBatch {
  id: string
  reference?: string
  status: WompiPayoutBatchStatus
  amountInCents?: number | string
  totalTransactions?: number
}

export interface WompiPayoutTransaction {
  id: string
  payoutId?: string
  reference?: string
  status: WompiPayoutTransactionStatus
  amountInCents?: number | string
  failureReason?: {
    code?: string
    message?: string
  } | null
}

export interface WompiBrebPreview {
  holderName: string
  financialEntity: {
    name: string
    code: string
  }
  keyType: string
  keyValue: string
}

export interface WompiBrebDestination {
  key: string
  keyType: WompiBrebKeyType
  name: string
  email: string
}

export class WompiPayoutApiError extends Error {
  readonly code = 'WOMPI_PAYOUT_API_ERROR'
  readonly statusCode = 503

  constructor(readonly retryable: boolean) {
    super('Wompi Pagos a Terceros no pudo completar la operación de forma verificable.')
  }
}

function apiBase(): string {
  return config.WOMPI_PAYOUTS_ENV === 'production'
    ? 'https://api.payouts.wompi.co/v2'
    : 'https://api.sandbox.payouts.wompi.co/v2'
}

export function getWompiPayoutConfigurationState(): WompiPayoutConfigurationState {
  const values = [
    config.WOMPI_PAYOUTS_API_KEY,
    config.WOMPI_PAYOUTS_USER_PRINCIPAL_ID,
    config.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID,
    config.WOMPI_PAYOUTS_EVENT_SECRET,
    config.PAYOUT_DESTINATION_PEPPER,
  ]
  if (values.every((value) => !value)) return 'disabled'
  return values.every(Boolean) ? 'ready' : 'misconfigured'
}

function requireProviderConfiguration(): {
  apiKey: string
  userPrincipalId: string
  sourceAccountId: string
} {
  if (
    getWompiPayoutConfigurationState() !== 'ready'
    || !config.WOMPI_PAYOUTS_API_KEY
    || !config.WOMPI_PAYOUTS_USER_PRINCIPAL_ID
    || !config.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID
  ) {
    throw Object.assign(new Error('El proveedor de desembolsos no está configurado.'), {
      statusCode: 503,
      code: 'PAYOUT_PROVIDER_UNAVAILABLE',
    })
  }
  return {
    apiKey: config.WOMPI_PAYOUTS_API_KEY,
    userPrincipalId: config.WOMPI_PAYOUTS_USER_PRINCIPAL_ID,
    sourceAccountId: config.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID,
  }
}

async function wompiPayoutRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const credentials = requireProviderConfiguration()
  let response: Response
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': credentials.apiKey,
        'user-principal-id': credentials.userPrincipalId,
        'business-application-id': 'WOMPI_PAYOUTS',
        ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new WompiPayoutApiError(true)
  }

  if (!response.ok) {
    throw new WompiPayoutApiError(response.status >= 500 || response.status === 429)
  }

  return await response.json() as T
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null
}

function resourceRecord(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload)
  if (!root) return null
  return asRecord(root.data) ?? root
}

function resourceId(resource: Record<string, unknown> | null): string | null {
  if (!resource) return null
  return asString(resource.id) ?? asString(resource._id) ?? asString(resource.payoutId)
}

function resourceStatus(resource: Record<string, unknown> | null): string {
  return asString(resource?.status) ?? 'UNKNOWN'
}

function listRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((value): value is Record<string, unknown> => Boolean(value))
  const root = asRecord(payload)
  if (!root) return []
  const data = root.data
  if (Array.isArray(data)) return listRecords(data)
  const dataRecord = asRecord(data)
  for (const candidate of [
    dataRecord?.items,
    dataRecord?.payouts,
    dataRecord?.transactions,
    dataRecord?.results,
    root.items,
    root.payouts,
    root.transactions,
    root.results,
  ]) {
    if (Array.isArray(candidate)) return listRecords(candidate)
  }
  return dataRecord ? [dataRecord] : []
}

function toBatch(resource: Record<string, unknown>): WompiPayoutBatch | null {
  const id = resourceId(resource)
  if (!id) return null
  const amount = resource.amountInCents ?? resource.amount
  return {
    id,
    reference: asString(resource.reference) ?? undefined,
    status: resourceStatus(resource),
    amountInCents: typeof amount === 'number' || typeof amount === 'string' ? amount : undefined,
    totalTransactions: typeof resource.totalTransactions === 'number' ? resource.totalTransactions : undefined,
  }
}

function toTransaction(resource: Record<string, unknown>): WompiPayoutTransaction | null {
  const id = resourceId(resource)
  if (!id) return null
  const failureReason = asRecord(resource.failureReason)
  const amount = resource.amountInCents ?? resource.amount
  return {
    id,
    payoutId: asString(resource.payoutId) ?? undefined,
    reference: asString(resource.reference) ?? undefined,
    status: resourceStatus(resource),
    amountInCents: typeof amount === 'number' || typeof amount === 'string' ? amount : undefined,
    failureReason: failureReason
      ? { code: asString(failureReason.code) ?? undefined, message: asString(failureReason.message) ?? undefined }
      : null,
  }
}

export async function resolveWompiBrebKey(input: {
  key: string
  keyType: WompiBrebKeyType
}): Promise<WompiBrebPreview> {
  const payload = await wompiPayoutRequest<unknown>(
    `/breb/keys/resolve/${encodeURIComponent(input.key)}?keyType=${encodeURIComponent(input.keyType)}`,
  )
  const resource = resourceRecord(payload)
  const financialEntity = asRecord(resource?.financialEntity)
  const holderName = asString(resource?.holderName)
  const entityName = asString(financialEntity?.name)
  const entityCode = asString(financialEntity?.code)
  const keyType = asString(resource?.keyType)
  const keyValue = asString(resource?.keyValue)
  if (!holderName || !entityName || !entityCode || !keyType || !keyValue) {
    throw new WompiPayoutApiError(false)
  }
  return {
    holderName,
    financialEntity: { name: entityName, code: entityCode },
    keyType,
    keyValue,
  }
}

export async function createWompiBrebPayout(input: {
  reference: string
  transactionReference: string
  idempotencyKey: string
  amountInCents: number
  destination: WompiBrebDestination
}): Promise<{ payoutId: string | null; status: string; traceId: string | null }> {
  const credentials = requireProviderConfiguration()
  const payload = await wompiPayoutRequest<unknown>('/payouts', {
    method: 'POST',
    idempotencyKey: input.idempotencyKey,
    body: {
      reference: input.reference,
      accountId: credentials.sourceAccountId,
      paymentType: 'OTHER',
      transactions: [{
        amount: input.amountInCents,
        name: input.destination.name,
        email: input.destination.email,
        key: input.destination.key,
        reference: input.transactionReference,
      }],
    },
  })
  const root = asRecord(payload)
  const resource = resourceRecord(payload)
  const meta = asRecord(root?.meta)
  return {
    payoutId: resourceId(resource),
    status: resourceStatus(resource),
    traceId: asString(meta?.trace_id),
  }
}

export async function findWompiPayoutByReference(reference: string): Promise<WompiPayoutBatch | null> {
  const payload = await wompiPayoutRequest<unknown>(`/payouts?reference=${encodeURIComponent(reference)}&limit=10&page=1`)
  for (const record of listRecords(payload)) {
    const batch = toBatch(record)
    if (batch?.reference === reference) return batch
  }
  return null
}

export async function getWompiPayout(payoutId: string): Promise<WompiPayoutBatch> {
  const payload = await wompiPayoutRequest<unknown>(`/payouts/${encodeURIComponent(payoutId)}`)
  const resource = resourceRecord(payload)
  const batch = resource ? toBatch(resource) : null
  if (!batch) throw new WompiPayoutApiError(false)
  return batch
}

export async function getWompiPayoutTransactions(payoutId: string): Promise<WompiPayoutTransaction[]> {
  const payload = await wompiPayoutRequest<unknown>(`/payouts/${encodeURIComponent(payoutId)}/transactions?limit=10&page=1`)
  return listRecords(payload)
    .map(toTransaction)
    .filter((value): value is WompiPayoutTransaction => Boolean(value))
}

function readSignedProperty(data: unknown, path: string): string {
  const segments = path.split('.')
  if (!segments.length || segments.some((segment) => !segment || ['__proto__', 'prototype', 'constructor'].includes(segment))) {
    throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
  }
  let current: unknown = data
  for (const segment of segments) {
    const record = asRecord(current)
    if (!record || !(segment in record)) {
      throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
    }
    current = record[segment]
  }
  if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') return String(current)
  throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
}

export interface VerifiedWompiPayoutWebhook {
  event: string
  data: Record<string, unknown>
  timestamp: string
  checksum: string
  eventKey: string
}

export function verifyWompiPayoutWebhook(input: {
  xEventChecksum?: string
  body: unknown
}): VerifiedWompiPayoutWebhook {
  if (!config.WOMPI_PAYOUTS_EVENT_SECRET) {
    throw Object.assign(new Error('Webhook de payout no configurado.'), { statusCode: 503, code: 'PAYOUT_WEBHOOK_UNAVAILABLE' })
  }
  const body = asRecord(input.body)
  const data = asRecord(body?.data)
  const signature = asRecord(body?.signature)
  const properties = signature?.properties
  const checksum = asString(signature?.checksum)
  const event = asString(body?.event)
  const timestamp = asString(body?.timestamp)
  if (!body || !data || !Array.isArray(properties) || !properties.length || !checksum || !event || !timestamp) {
    throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
  }
  if (!/^[a-f0-9]{64}$/i.test(checksum)) {
    throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
  }
  if (input.xEventChecksum && input.xEventChecksum.toLowerCase() !== checksum.toLowerCase()) {
    throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
  }

  const signedValues = properties.map((property) => {
    if (typeof property !== 'string') {
      throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
    }
    return readSignedProperty(data, property)
  })
  const expected = createHash('sha256')
    .update(`${signedValues.join('')}${timestamp}${config.WOMPI_PAYOUTS_EVENT_SECRET}`)
    .digest()
  const supplied = Buffer.from(checksum, 'hex')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    throw Object.assign(new Error('Firma de payout inválida.'), { statusCode: 401, code: 'INVALID_PAYOUT_WEBHOOK_SIGNATURE' })
  }

  return {
    event,
    data,
    timestamp,
    checksum,
    eventKey: createHash('sha256').update(`${event}|${timestamp}|${checksum}`).digest('hex'),
  }
}

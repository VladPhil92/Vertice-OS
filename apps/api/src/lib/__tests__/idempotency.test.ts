const mockQueryRaw = jest.fn()
const mockExecuteRaw = jest.fn()

jest.mock('../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}))

import {
  executeIdempotentMutation,
  normalizeRequestedIdempotencyKey,
  requestFingerprint,
} from '../idempotency'

type Receipt = {
  id: string
  request_hash: string
  state: 'processing' | 'completed' | 'failed'
  response_status: number | null
  response_body: unknown
  failure_code: string | null
  expires_at: Date
}

const CITIZEN_ID = '11111111-1111-4111-8111-111111111111'
const SCOPE = 'proposal:create'
const PAYLOAD = { title: 'Parque seguro', scope: 'neighborhood' }

function receipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: 'receipt-1',
    request_hash: requestFingerprint(SCOPE, PAYLOAD),
    state: 'completed',
    response_status: 201,
    response_body: { id: 'proposal-1' },
    failure_code: null,
    expires_at: new Date(Date.now() + 60_000),
    ...overrides,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('durable mutation idempotency contract', () => {
  it('canonicalizes object key order before fingerprinting', () => {
    const a = requestFingerprint('proposal:create', {
      title: 'Parque seguro',
      nested: { scope: 'neighborhood', votes: [1, 2, 3] },
    })
    const b = requestFingerprint('proposal:create', {
      nested: { votes: [1, 2, 3], scope: 'neighborhood' },
      title: 'Parque seguro',
    })

    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('separates operations by scope and payload', () => {
    const base = requestFingerprint('proposal:create', { title: 'A' })
    expect(requestFingerprint('proposal:create', { title: 'B' })).not.toBe(base)
    expect(requestFingerprint('report:create', { title: 'A' })).not.toBe(base)
  })

  it('accepts a bounded client idempotency key', () => {
    expect(normalizeRequestedIdempotencyKey(' civic-create:abc123 ')).toBe('civic-create:abc123')
  })

  it('rejects malformed or undersized keys before reserving a receipt', () => {
    expect(() => normalizeRequestedIdempotencyKey('short')).toThrow()
    try {
      normalizeRequestedIdempotencyKey('contains spaces and is invalid')
      throw new Error('expected INVALID_IDEMPOTENCY_KEY')
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
      })
    }
  })

  it('treats a missing header as an instruction to derive a privacy-safe key', () => {
    expect(normalizeRequestedIdempotencyKey(undefined)).toBeUndefined()
  })

  it('reserves, executes and completes a first client-keyed mutation exactly once', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'receipt-1' }])
    mockExecuteRaw.mockResolvedValueOnce(1)
    const operation = jest.fn().mockResolvedValue({ id: 'proposal-1' })

    const result = await executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-001',
      successStatus: 201,
      operation,
    })

    expect(operation).toHaveBeenCalledTimes(1)
    expect(operation).toHaveBeenCalledWith('proposal:request-001')
    expect(result).toEqual({
      value: { id: 'proposal-1' },
      statusCode: 201,
      replayed: false,
      idempotencyKey: 'proposal:request-001',
      keySource: 'client',
    })
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('derives a stable privacy-safe key when the client does not send one', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'receipt-1' }])
    mockExecuteRaw.mockResolvedValueOnce(1)
    const operation = jest.fn().mockResolvedValue({ ok: true })

    const result = await executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      operation,
    })

    expect(result.keySource).toBe('derived')
    expect(result.idempotencyKey).toMatch(/^auto:[a-f0-9]{48}$/)
    expect(operation).toHaveBeenCalledWith(result.idempotencyKey)
  })

  it('replays a completed receipt without executing the domain mutation again', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt()])
    const operation = jest.fn()

    const result = await executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-002',
      operation,
    })

    expect(operation).not.toHaveBeenCalled()
    expect(result.replayed).toBe(true)
    expect(result.statusCode).toBe(201)
    expect(result.value).toEqual({ id: 'proposal-1' })
  })

  it('rejects reuse of the same key for a different request fingerprint', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({ request_hash: '0'.repeat(64) })])

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-003',
      operation: jest.fn(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('fails closed while an earlier execution is still processing', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({ state: 'processing', response_status: null, response_body: null })])

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-004',
      operation: jest.fn(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_IN_PROGRESS' })
  })

  it('keeps an expired processing receipt fail-closed instead of re-executing it', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({
        state: 'processing',
        response_status: null,
        response_body: null,
        expires_at: new Date(Date.now() - 1_000),
      })])
    const operation = jest.fn()

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-stale-processing',
      operation,
    })).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_IN_PROGRESS' })

    expect(operation).not.toHaveBeenCalled()
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('requires reconciliation after an earlier failed/uncertain execution', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({
        state: 'failed',
        response_status: null,
        response_body: null,
        failure_code: 'PROVIDER_TIMEOUT',
      })])

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-005',
      operation: jest.fn(),
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_RECONCILIATION_REQUIRED:PROVIDER_TIMEOUT',
    })
  })

  it('preserves an expired failed receipt and still requires reconciliation', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({
        state: 'failed',
        response_status: null,
        response_body: null,
        failure_code: 'COMMIT_UNCERTAIN',
        expires_at: new Date(Date.now() - 1_000),
      })])
    const operation = jest.fn()

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-stale-failed',
      operation,
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_RECONCILIATION_REQUIRED:COMMIT_UNCERTAIN',
    })

    expect(operation).not.toHaveBeenCalled()
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('removes an expired completed receipt and safely reserves a fresh execution', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({ expires_at: new Date(Date.now() - 1_000) })])
      .mockResolvedValueOnce([{ id: 'receipt-2' }])
    mockExecuteRaw
      .mockResolvedValueOnce(1) // delete expired completed receipt
      .mockResolvedValueOnce(1) // complete fresh receipt
    const operation = jest.fn().mockResolvedValue({ id: 'proposal-2' })

    const result = await executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-006',
      successStatus: 201,
      operation,
    })

    expect(operation).toHaveBeenCalledTimes(1)
    expect(result.replayed).toBe(false)
    expect(result.value).toEqual({ id: 'proposal-2' })
  })

  it('re-loads the winner when another request wins the expired-completed reservation race', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({ expires_at: new Date(Date.now() - 1_000) })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt({ response_status: 202, response_body: { id: 'winner' } })])
    mockExecuteRaw.mockResolvedValueOnce(1)
    const operation = jest.fn()

    const result = await executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-007',
      operation,
    })

    expect(operation).not.toHaveBeenCalled()
    expect(result).toMatchObject({ replayed: true, statusCode: 202, value: { id: 'winner' } })
  })

  it('fails closed when a duplicate reservation has no observable receipt state', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-008',
      operation: jest.fn(),
    })).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_STATE_UNAVAILABLE' })
  })

  it('marks the receipt failed and preserves the original domain error', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'receipt-1' }])
    mockExecuteRaw.mockResolvedValueOnce(1)
    const domainError = Object.assign(new Error('provider timeout'), { code: 'PROVIDER_TIMEOUT' })

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-009',
      operation: jest.fn().mockRejectedValue(domainError),
    })).rejects.toBe(domainError)

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('does not mask the domain error if persisting the failure marker also fails', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'receipt-1' }])
    mockExecuteRaw.mockRejectedValueOnce(new Error('database unavailable'))
    const domainError = new Error('mutation failed')

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-010',
      operation: jest.fn().mockRejectedValue(domainError),
    })).rejects.toBe(domainError)
  })

  it('reports an uncertain commit instead of repeating a mutation whose receipt cannot complete', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'receipt-1' }])
    mockExecuteRaw.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'proposal:request-011',
      operation: jest.fn().mockResolvedValue({ id: 'proposal-3' }),
    })).rejects.toMatchObject({ statusCode: 503, code: 'IDEMPOTENCY_COMMIT_UNCERTAIN' })
  })

  it('rejects invalid scopes and malformed direct requested keys before touching PostgreSQL', async () => {
    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: '   ',
      payload: PAYLOAD,
      operation: jest.fn(),
    })).rejects.toMatchObject({ statusCode: 500, code: 'INVALID_IDEMPOTENCY_SCOPE' })

    await expect(executeIdempotentMutation({
      citizenId: CITIZEN_ID,
      scope: SCOPE,
      payload: PAYLOAD,
      requestedKey: 'bad key',
      operation: jest.fn(),
    })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_IDEMPOTENCY_KEY' })

    expect(mockQueryRaw).not.toHaveBeenCalled()
  })
})

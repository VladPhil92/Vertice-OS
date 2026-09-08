import { createHash } from 'node:crypto'
import { config } from '../../../config'
import {
  WompiPayoutApiError,
  createWompiBrebPayout,
  findWompiPayoutByReference,
  getWompiPayout,
  getWompiPayoutConfigurationState,
  getWompiPayoutTransactions,
  resolveWompiBrebKey,
  verifyWompiPayoutWebhook,
} from '../wompi-payouts.provider'

type MutableConfig = {
  WOMPI_PAYOUTS_API_KEY?: string
  WOMPI_PAYOUTS_USER_PRINCIPAL_ID?: string
  WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID?: string
  WOMPI_PAYOUTS_EVENT_SECRET?: string
  PAYOUT_DESTINATION_PEPPER?: string
}

const mutableConfig = config as unknown as MutableConfig
const original = {
  WOMPI_PAYOUTS_API_KEY: mutableConfig.WOMPI_PAYOUTS_API_KEY,
  WOMPI_PAYOUTS_USER_PRINCIPAL_ID: mutableConfig.WOMPI_PAYOUTS_USER_PRINCIPAL_ID,
  WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID: mutableConfig.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID,
  WOMPI_PAYOUTS_EVENT_SECRET: mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET,
  PAYOUT_DESTINATION_PEPPER: mutableConfig.PAYOUT_DESTINATION_PEPPER,
}

beforeEach(() => {
  mutableConfig.WOMPI_PAYOUTS_API_KEY = undefined
  mutableConfig.WOMPI_PAYOUTS_USER_PRINCIPAL_ID = undefined
  mutableConfig.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID = undefined
  mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = undefined
  mutableConfig.PAYOUT_DESTINATION_PEPPER = undefined
})

afterAll(() => {
  Object.assign(mutableConfig, original)
})

describe('getWompiPayoutConfigurationState', () => {
  it('reports disabled when no payout configuration exists', () => {
    expect(getWompiPayoutConfigurationState()).toBe('disabled')
  })

  it('reports misconfigured when payout configuration is partial', () => {
    mutableConfig.WOMPI_PAYOUTS_API_KEY = 'sandbox-key-with-enough-length'
    expect(getWompiPayoutConfigurationState()).toBe('misconfigured')
  })

  it('reports ready only when provider and destination-fingerprint configuration is complete', () => {
    mutableConfig.WOMPI_PAYOUTS_API_KEY = 'sandbox-key-with-enough-length'
    mutableConfig.WOMPI_PAYOUTS_USER_PRINCIPAL_ID = '550e8400-e29b-41d4-a716-446655440001'
    mutableConfig.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440002'
    mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = 'signed-event-secret-with-enough-length'
    mutableConfig.PAYOUT_DESTINATION_PEPPER = 'destination-pepper-with-at-least-thirty-two-characters'
    expect(getWompiPayoutConfigurationState()).toBe('ready')
  })
})

describe('verifyWompiPayoutWebhook', () => {
  it('verifies the provider-declared dynamic property order', () => {
    const secret = 'signed-event-secret-with-enough-length'
    mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = secret
    const timestamp = '1788867600000'
    const data = {
      payout: { id: 'payout-123', status: 'PENDING_APPROVAL' },
      transaction: { id: 'tx-456', status: 'PENDING' },
    }
    const properties = ['transaction.status', 'payout.id', 'transaction.id']
    const signed = `${data.transaction.status}${data.payout.id}${data.transaction.id}${timestamp}${secret}`
    const checksum = createHash('sha256').update(signed).digest('hex')
    const body = {
      event: 'transaction.updated',
      data,
      timestamp,
      signature: { properties, checksum },
    }

    expect(verifyWompiPayoutWebhook({ xEventChecksum: checksum, body })).toMatchObject({
      event: 'transaction.updated',
      timestamp,
      checksum,
    })
  })

  it('rejects a checksum that does not match the signed body', () => {
    mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = 'signed-event-secret-with-enough-length'
    const body = {
      event: 'payout.updated',
      data: { payout: { id: 'payout-123', status: 'PENDING' } },
      timestamp: '1788867600000',
      signature: {
        properties: ['payout.id', 'payout.status'],
        checksum: 'a'.repeat(64),
      },
    }

    expect(() => verifyWompiPayoutWebhook({ xEventChecksum: 'a'.repeat(64), body }))
      .toThrow('Firma de payout inválida.')
  })

  it('rejects unsafe or missing signature property paths', () => {
    mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = 'signed-event-secret-with-enough-length'
    const body = {
      event: 'payout.updated',
      data: { payout: { id: 'payout-123' } },
      timestamp: '1788867600000',
      signature: {
        properties: ['payout.__proto__.polluted'],
        checksum: 'a'.repeat(64),
      },
    }

    expect(() => verifyWompiPayoutWebhook({ body })).toThrow('Firma de payout inválida.')
  })
})

describe('Wompi payout provider network contract', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    mutableConfig.WOMPI_PAYOUTS_API_KEY = 'sandbox-key-with-enough-length'
    mutableConfig.WOMPI_PAYOUTS_USER_PRINCIPAL_ID = '550e8400-e29b-41d4-a716-446655440001'
    mutableConfig.WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440002'
    mutableConfig.WOMPI_PAYOUTS_EVENT_SECRET = 'signed-event-secret-with-enough-length'
    mutableConfig.PAYOUT_DESTINATION_PEPPER = 'destination-pepper-with-at-least-thirty-two-characters'
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('fails closed when the provider is not fully configured', async () => {
    mutableConfig.WOMPI_PAYOUTS_API_KEY = undefined

    await expect(getWompiPayout('payout-1')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PAYOUT_PROVIDER_UNAVAILABLE',
    })
  })

  it('marks a network failure as retryable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    await expect(getWompiPayout('payout-1')).rejects.toMatchObject({ code: 'WOMPI_PAYOUT_API_ERROR', retryable: true })
  })

  it('marks a 5xx response as retryable and a 4xx response as definitive', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 500 })) as unknown as typeof fetch
    await expect(getWompiPayout('payout-1')).rejects.toMatchObject({ retryable: true })

    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 404 })) as unknown as typeof fetch
    await expect(getWompiPayout('payout-1')).rejects.toMatchObject({ retryable: false })
  })

  it('resolves a BRE-B key preview from the provider envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        holderName: 'Juana Pérez',
        financialEntity: { name: 'Banco Ejemplo', code: '1234' },
        keyType: 'MAIL',
        keyValue: 'juana@example.com',
      },
    }), { status: 200 })) as unknown as typeof fetch

    const preview = await resolveWompiBrebKey({ key: 'juana@example.com', keyType: 'MAIL' })

    expect(preview).toEqual({
      holderName: 'Juana Pérez',
      financialEntity: { name: 'Banco Ejemplo', code: '1234' },
      keyType: 'MAIL',
      keyValue: 'juana@example.com',
    })
  })

  it('rejects a BRE-B preview response missing required fields', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { holderName: 'Juana Pérez' },
    }), { status: 200 })) as unknown as typeof fetch

    await expect(resolveWompiBrebKey({ key: 'juana@example.com', keyType: 'MAIL' }))
      .rejects.toBeInstanceOf(WompiPayoutApiError)
  })

  it('creates a BRE-B payout and forwards the idempotency key header', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'payout-99', status: 'PENDING_APPROVAL' },
      meta: { trace_id: 'trace-1' },
    }), { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await createWompiBrebPayout({
      reference: 'vertice-ref-1',
      transactionReference: 'vp-tx-1',
      idempotencyKey: 'idem-key-1',
      amountInCents: 500_000,
      destination: { key: 'juana@example.com', keyType: 'MAIL', name: 'Juana Pérez', email: 'juana@example.com' },
    })

    expect(result).toEqual({ payoutId: 'payout-99', status: 'PENDING_APPROVAL', traceId: 'trace-1' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/payouts'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'idempotency-key': 'idem-key-1' }),
      }),
    )
  })

  it('finds a payout batch by reference among listed payouts', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [
          { id: 'payout-1', reference: 'other-ref', status: 'PENDING' },
          { id: 'payout-2', reference: 'vertice-ref-1', status: 'PENDING_APPROVAL' },
        ],
      },
    }), { status: 200 })) as unknown as typeof fetch

    const found = await findWompiPayoutByReference('vertice-ref-1')

    expect(found).toEqual({ id: 'payout-2', reference: 'vertice-ref-1', status: 'PENDING_APPROVAL', amountInCents: undefined, totalTransactions: undefined })
  })

  it('returns null when no listed payout matches the reference', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: { items: [] } }), { status: 200 })) as unknown as typeof fetch

    expect(await findWompiPayoutByReference('missing-ref')).toBeNull()
  })

  it('rejects a payout lookup whose response cannot be parsed as a batch', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 })) as unknown as typeof fetch

    await expect(getWompiPayout('payout-1')).rejects.toBeInstanceOf(WompiPayoutApiError)
  })

  it('lists payout transactions mapped from the provider envelope', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        transactions: [
          { id: 'tx-1', status: 'APPROVED', amountInCents: 500_000 },
          { id: 'tx-2', status: 'FAILED', failureReason: { code: 'INSUFFICIENT_FUNDS', message: 'No hay fondos' } },
        ],
      },
    }), { status: 200 })) as unknown as typeof fetch

    const transactions = await getWompiPayoutTransactions('payout-1')

    expect(transactions).toHaveLength(2)
    expect(transactions[1].failureReason).toEqual({ code: 'INSUFFICIENT_FUNDS', message: 'No hay fondos' })
  })
})

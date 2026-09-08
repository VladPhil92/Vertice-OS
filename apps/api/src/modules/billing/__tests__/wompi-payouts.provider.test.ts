import { createHash } from 'node:crypto'
import { config } from '../../../config'
import {
  getWompiPayoutConfigurationState,
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

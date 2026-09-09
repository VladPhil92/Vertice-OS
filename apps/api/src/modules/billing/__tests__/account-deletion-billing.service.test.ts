const mockQueryRaw = jest.fn()
const mockCancelSubscription = jest.fn()
const mockConfigurationState = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../mercadopago.provider', () => ({
  MercadoPagoBillingProvider: jest.fn().mockImplementation(() => ({
    cancelSubscription: mockCancelSubscription,
  })),
  getMercadoPagoConfigurationState: mockConfigurationState,
}))

import { prepareRecurringBillingForAccountDeletion } from '../account-deletion-billing.service'

beforeEach(() => {
  jest.resetAllMocks()
  mockConfigurationState.mockReturnValue('ready')
  mockCancelSubscription.mockResolvedValue(undefined)
})

describe('account deletion recurring billing guard', () => {
  it('is a no-op when the citizen has no recurring billing bindings', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(prepareRecurringBillingForAccountDeletion('citizen-id')).resolves.toBeUndefined()
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it('cancels each distinct Mercado Pago mandate before erasure', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { source: 'subscription', provider: 'mercadopago', external_id: 'preapproval-1', status: 'active' },
      { source: 'transaction', provider: 'mercadopago', external_id: 'preapproval-1', status: 'authorized' },
      { source: 'transaction', provider: 'mercadopago', external_id: 'preapproval-2', status: 'pending' },
    ])

    await prepareRecurringBillingForAccountDeletion('citizen-id')

    expect(mockCancelSubscription).toHaveBeenCalledTimes(2)
    expect(mockCancelSubscription).toHaveBeenCalledWith('preapproval-1')
    expect(mockCancelSubscription).toHaveBeenCalledWith('preapproval-2')
  })

  it('allows a purely local pending checkout row with no provider mandate', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { source: 'transaction', provider: 'mercadopago', external_id: null, status: 'pending' },
    ])

    await expect(prepareRecurringBillingForAccountDeletion('citizen-id')).resolves.toBeUndefined()
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it('fails closed when an active recurring record cannot be reconciled to a provider id', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { source: 'subscription', provider: 'mercadopago', external_id: null, status: 'active' },
    ])

    await expect(
      prepareRecurringBillingForAccountDeletion('citizen-id'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_DELETION_BILLING_RECONCILIATION_REQUIRED',
    })
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it('fails closed when the provider cannot be used to cancel a known mandate', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { source: 'subscription', provider: 'mercadopago', external_id: 'preapproval-1', status: 'active' },
    ])
    mockConfigurationState.mockReturnValueOnce('disabled')

    await expect(
      prepareRecurringBillingForAccountDeletion('citizen-id'),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'ACCOUNT_DELETION_BILLING_PROVIDER_UNAVAILABLE',
    })
    expect(mockCancelSubscription).not.toHaveBeenCalled()
  })

  it('does not erase through a failed provider cancellation', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { source: 'subscription', provider: 'mercadopago', external_id: 'preapproval-1', status: 'active' },
    ])
    mockCancelSubscription.mockRejectedValueOnce(new Error('provider unavailable'))

    await expect(
      prepareRecurringBillingForAccountDeletion('citizen-id'),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'ACCOUNT_DELETION_BILLING_CANCELLATION_FAILED',
    })
  })
})

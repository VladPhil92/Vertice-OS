const mockRootQueryRaw = jest.fn()
const mockTxQueryRaw = jest.fn()
const mockTxExecuteRaw = jest.fn()
const mockDelCache = jest.fn().mockResolvedValue(undefined)
const mockPrepareRecurringBilling = jest.fn().mockResolvedValue(undefined)

const mockTx = {
  $queryRaw: mockTxQueryRaw,
  $executeRaw: mockTxExecuteRaw,
}

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockRootQueryRaw,
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/cache', () => ({
  delCache: mockDelCache,
}))

jest.mock('../../billing/account-deletion-billing.service', () => ({
  prepareRecurringBillingForAccountDeletion: mockPrepareRecurringBilling,
}))

import { prisma } from '../../../lib/prisma'
import { deleteCitizenAccount } from '../account-deletion.service'

function sqlText(mock: jest.Mock, callIndex: number): string {
  const query = mock.mock.calls[callIndex]?.[0] as { strings?: string[]; sql?: string } | undefined
  return query?.strings?.join('') ?? query?.sql ?? ''
}

function allSqlText(mock: jest.Mock): string {
  return mock.mock.calls
    .map(([query]) => (query as { strings?: string[]; sql?: string })?.strings?.join('') ?? '')
    .join('\n')
}

function healthyAccount(overrides: Partial<Record<string, boolean>> = {}) {
  return {
    id: 'citizen-id',
    is_active: true,
    live_session: true,
    canonical_root: false,
    has_active_privilege_descendants: false,
    has_open_payout: false,
    ...overrides,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  mockDelCache.mockResolvedValue(undefined)
  mockPrepareRecurringBilling.mockResolvedValue(undefined)
  mockTxExecuteRaw.mockResolvedValue(1)
  ;(prisma.$transaction as jest.Mock).mockImplementation(
    async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
  )
})

describe('Store privacy account deletion', () => {
  it('erases direct identity, cancels billing links and queues external avatar purge atomically', async () => {
    const completedAt = new Date('2026-09-09T18:45:00.000Z')
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount()])
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // authority advisory lock
      .mockResolvedValueOnce([healthyAccount()])
      .mockResolvedValueOnce([{ id: 'asset-row', provider_asset_id: 'cf-avatar-123' }])
      .mockResolvedValueOnce([{ completed_at: completedAt }])

    const receipt = await deleteCitizenAccount('citizen-id', 'session-id', 'mobile')

    expect(mockPrepareRecurringBilling).toHaveBeenCalledWith('citizen-id')
    expect(receipt.status).toBe('completed')
    expect(receipt.completed_at).toBe(completedAt.toISOString())
    expect(receipt.auxiliary_cleanup_queued).toBe(true)
    expect(receipt.retained_categories).toEqual(expect.arrayContaining([
      'civic_records_pseudonymized',
      'financial_records_required_for_accounting_or_disputes',
    ]))

    expect(sqlText(mockRootQueryRaw, 0)).toContain('crowdfunding_payout_requests')
    expect(sqlText(mockTxQueryRaw, 0)).toContain('pg_advisory_xact_lock')
    expect(sqlText(mockTxQueryRaw, 1)).toContain('s.id =')
    expect(sqlText(mockTxQueryRaw, 1)).toContain('s.revoked_at IS NULL')
    expect(sqlText(mockTxQueryRaw, 1)).toContain("g.source = 'ctg_one_bootstrap'")

    const writes = allSqlText(mockTxExecuteRaw)
    expect(writes).toContain('UPDATE sessions')
    expect(writes).toContain('DELETE FROM mobile_push_devices')
    expect(writes).toContain('DELETE FROM external_identities')
    expect(writes).toContain('DELETE FROM civic_identity_proof_events')
    expect(writes).toContain('DELETE FROM civic_identity_proofs')
    expect(writes).toContain('DELETE FROM civic_profile_follows')
    expect(writes).toContain('DELETE FROM scheduled_civic_publications')
    expect(writes).toContain('DELETE FROM legal_documents')
    expect(writes).toContain('UPDATE territorial_reports SET citizen_id = NULL')
    expect(writes).toContain('UPDATE proposals SET author_id = NULL')
    expect(writes).toContain("status = 'suspended', compliance_status = 'suspended'")
    expect(writes).toContain('DELETE FROM crowdfunding_updates')
    expect(writes).toContain('UPDATE crowdfunding_contributions SET contributor_citizen_id = NULL')
    expect(writes).toContain('DELETE FROM subscriptions')
    expect(writes).toContain('DELETE FROM billing_usage_counters')
    expect(writes).toContain('UPDATE payment_transactions SET citizen_id = NULL')
    expect(writes).toContain('email = NULL')
    expect(writes).toContain('cedula_hash = NULL')
    expect(writes).toContain('password_hash = NULL')
    expect(writes).toContain('public_civic_profile = FALSE')
    expect(writes).toContain('is_active = FALSE')
    expect(writes).toContain('INSERT INTO account_deletion_requests')
    expect(writes).toContain("'purge_deleted_identity_auxiliary'")
    expect(mockDelCache).toHaveBeenCalledWith('profile', 'citizen-id')
  })

  it('requires the authenticated access token to map to a live server-side session before billing cancellation', async () => {
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount({ live_session: false })])

    await expect(
      deleteCitizenAccount('citizen-id', 'stale-session', 'web'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'ACCOUNT_DELETION_REAUTH_REQUIRED' })

    expect(mockPrepareRecurringBilling).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('protects the canonical root account before touching external billing', async () => {
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount({ canonical_root: true })])

    await expect(
      deleteCitizenAccount('root-id', 'session-id', 'web'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ROOT_ACCOUNT_DELETION_PROTECTED' })

    expect(mockPrepareRecurringBilling).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not orphan active delegated authority', async () => {
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount({ has_active_privilege_descendants: true })])

    await expect(
      deleteCitizenAccount('delegating-admin', 'session-id', 'web'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_DELETION_AUTHORITY_TRANSFER_REQUIRED',
    })

    expect(mockPrepareRecurringBilling).not.toHaveBeenCalled()
  })

  it('blocks deletion while a payout still needs the beneficiary/requester identity', async () => {
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount({ has_open_payout: true })])

    await expect(
      deleteCitizenAccount('citizen-id', 'session-id', 'web'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_DELETION_PAYOUT_RECONCILIATION_REQUIRED',
    })

    expect(mockPrepareRecurringBilling).not.toHaveBeenCalled()
  })

  it('revalidates destructive authority after external recurring cancellation', async () => {
    mockRootQueryRaw.mockResolvedValueOnce([healthyAccount()])
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([healthyAccount({ live_session: false })])

    await expect(
      deleteCitizenAccount('citizen-id', 'session-id', 'web'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'ACCOUNT_DELETION_REAUTH_REQUIRED' })

    expect(mockPrepareRecurringBilling).toHaveBeenCalledWith('citizen-id')
    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })
})

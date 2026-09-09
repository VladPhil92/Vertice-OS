const mockTxQueryRaw = jest.fn()
const mockTxExecuteRaw = jest.fn()
const mockDelCache = jest.fn().mockResolvedValue(undefined)

const mockTx = {
  $queryRaw: mockTxQueryRaw,
  $executeRaw: mockTxExecuteRaw,
}

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/cache', () => ({
  delCache: mockDelCache,
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

beforeEach(() => {
  jest.resetAllMocks()
  mockDelCache.mockResolvedValue(undefined)
  mockTxExecuteRaw.mockResolvedValue(1)
  ;(prisma.$transaction as jest.Mock).mockImplementation(
    async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
  )
})

describe('Store privacy account deletion', () => {
  it('erases direct identity, revokes auth and queues external avatar purge atomically', async () => {
    const completedAt = new Date('2026-09-09T18:45:00.000Z')
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // authority advisory lock
      .mockResolvedValueOnce([{
        id: 'citizen-id',
        is_active: true,
        live_session: true,
        canonical_root: false,
        has_active_privilege_descendants: false,
      }])
      .mockResolvedValueOnce([{ id: 'asset-row', provider_asset_id: 'cf-avatar-123' }])
      .mockResolvedValueOnce([{ completed_at: completedAt }])

    const receipt = await deleteCitizenAccount('citizen-id', 'session-id', 'mobile')

    expect(receipt.status).toBe('completed')
    expect(receipt.completed_at).toBe(completedAt.toISOString())
    expect(receipt.auxiliary_cleanup_queued).toBe(true)
    expect(receipt.retained_categories).toEqual(expect.arrayContaining([
      'civic_records_pseudonymized',
      'financial_records_required_for_accounting_or_disputes',
    ]))

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
    expect(writes).toContain('UPDATE territorial_reports SET citizen_id = NULL')
    expect(writes).toContain('UPDATE proposals SET author_id = NULL')
    expect(writes).toContain('email = NULL')
    expect(writes).toContain('cedula_hash = NULL')
    expect(writes).toContain('password_hash = NULL')
    expect(writes).toContain('public_civic_profile = FALSE')
    expect(writes).toContain('is_active = FALSE')
    expect(writes).toContain('INSERT INTO account_deletion_requests')
    expect(writes).toContain("'purge_deleted_identity_auxiliary'")
    expect(mockDelCache).toHaveBeenCalledWith('profile', 'citizen-id')
  })

  it('requires the authenticated access token to map to a live server-side session', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'citizen-id',
        is_active: true,
        live_session: false,
        canonical_root: false,
        has_active_privilege_descendants: false,
      }])

    await expect(
      deleteCitizenAccount('citizen-id', 'stale-session', 'web'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'ACCOUNT_DELETION_REAUTH_REQUIRED' })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })

  it('protects the canonical root account from self-service deletion', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'root-id',
        is_active: true,
        live_session: true,
        canonical_root: true,
        has_active_privilege_descendants: false,
      }])

    await expect(
      deleteCitizenAccount('root-id', 'session-id', 'web'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ROOT_ACCOUNT_DELETION_PROTECTED' })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })

  it('does not orphan active delegated authority', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'delegating-admin',
        is_active: true,
        live_session: true,
        canonical_root: false,
        has_active_privilege_descendants: true,
      }])

    await expect(
      deleteCitizenAccount('delegating-admin', 'session-id', 'web'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACCOUNT_DELETION_AUTHORITY_TRANSFER_REQUIRED',
    })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })
})

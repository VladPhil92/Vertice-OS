const mockTxQueryRaw = jest.fn()
const mockTxExecuteRaw = jest.fn()
const mockTxCitizenFindUnique = jest.fn()
const mockTxCitizenUpdate = jest.fn()

const mockTx = {
  $queryRaw: mockTxQueryRaw,
  $executeRaw: mockTxExecuteRaw,
  citizen: {
    findUnique: mockTxCitizenFindUnique,
    update: mockTxCitizenUpdate,
  },
}

const mockRecordAuditEvent = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

jest.mock('../../../lib/audit', () => ({
  recordAuditEvent: mockRecordAuditEvent,
}))

import { prisma } from '../../../lib/prisma'
import {
  bootstrapFederatedSuperadmin,
  replaceCitizenRoles,
} from '../roles.service'

function queryText(callIndex: number): string {
  const query = mockTxQueryRaw.mock.calls[callIndex]?.[0] as { strings?: string[]; sql?: string } | undefined
  return query?.strings?.join('') ?? query?.sql ?? ''
}

beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
  mockTxExecuteRaw.mockResolvedValue(1)
  mockTxCitizenUpdate.mockResolvedValue({})
  mockTxCitizenFindUnique.mockResolvedValue({ id: 'target-id' })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx))
})

describe('superadmin authority serialization', () => {
  it('rejects removal of the last superadmin inside the serialized transaction', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // advisory lock
      .mockResolvedValueOnce([{ role: 'citizen' }, { role: 'superadmin' }])
      .mockResolvedValueOnce([{ total: 1n }])

    await expect(
      replaceCitizenRoles('actor-id', 'target-id', ['citizen']),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LAST_SUPERADMIN_PROTECTED' })

    expect(queryText(0)).toContain('pg_advisory_xact_lock')
    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
    expect(mockTxCitizenUpdate).not.toHaveBeenCalled()
    expect(mockRecordAuditEvent).not.toHaveBeenCalled()
  })

  it('allows a superadmin demotion when another active superadmin exists', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // advisory lock
      .mockResolvedValueOnce([{ role: 'citizen' }, { role: 'superadmin' }])
      .mockResolvedValueOnce([{ total: 2n }])

    const roles = await replaceCitizenRoles('actor-id', 'target-id', ['citizen'])

    expect(roles).toEqual(['citizen'])
    expect(queryText(0)).toContain('pg_advisory_xact_lock')
    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(3)
    expect(mockTxCitizenUpdate).toHaveBeenCalledWith({
      where: { id: 'target-id' },
      data: { role: 'citizen' },
    })
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-id',
        action: 'role.replace_grants',
        targetId: 'target-id',
        metadata: { before: ['citizen', 'superadmin'], after: ['citizen'] },
      }),
    )
  })

  it('bootstraps exactly the first federated superadmin under the same authority lock', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // advisory lock
      .mockResolvedValueOnce([{ has_grant: false, total_superadmins: 0n }])

    const role = await bootstrapFederatedSuperadmin('citizen-id', ['bootstrap_superadmin'])

    expect(role).toBe('superadmin')
    expect(queryText(0)).toContain('pg_advisory_xact_lock')
    expect(mockTxExecuteRaw).toHaveBeenCalledTimes(4)
    expect(mockTxCitizenUpdate).toHaveBeenCalledWith({
      where: { id: 'citizen-id' },
      data: { role: 'superadmin' },
    })
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.bootstrap_superadmin', targetId: 'citizen-id' }),
    )
  })

  it('blocks a second bootstrap identity once any other superadmin exists', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // advisory lock
      .mockResolvedValueOnce([{ has_grant: false, total_superadmins: 1n }])

    const role = await bootstrapFederatedSuperadmin('citizen-id', ['bootstrap_superadmin'])

    expect(role).toBeNull()
    expect(queryText(0)).toContain('pg_advisory_xact_lock')
    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
    expect(mockTxCitizenUpdate).not.toHaveBeenCalled()
    expect(mockRecordAuditEvent).not.toHaveBeenCalled()
  })
})
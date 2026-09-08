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

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}))

import { prisma } from '../../../lib/prisma'
import {
  grantCitizenRole,
  revokeCitizenRole,
} from '../role-delegation.service'

function sqlText(mock: jest.Mock, callIndex: number): string {
  const query = mock.mock.calls[callIndex]?.[0] as { strings?: string[]; sql?: string } | undefined
  return query?.strings?.join('') ?? query?.sql ?? ''
}

function sqlValues(mock: jest.Mock, callIndex: number): unknown[] {
  const query = mock.mock.calls[callIndex]?.[0] as { values?: unknown[] } | undefined
  return query?.values ?? []
}

beforeEach(() => {
  jest.resetAllMocks()
  mockTxCitizenFindUnique.mockResolvedValue({ id: 'target-id' })
  mockTxCitizenUpdate.mockResolvedValue({})
  mockTxExecuteRaw.mockResolvedValue(1)
  ;(prisma.$transaction as jest.Mock).mockImplementation(
    async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx),
  )
})

describe('P2 safe role delegation', () => {
  it('grants a privileged role without activating it and records audit in the same transaction', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([]) // advisory lock
      .mockResolvedValueOnce([{ role: 'citizen', source: 'session_baseline' }])

    const reason = 'Necesita moderar evidencias del piloto'
    const result = await grantCitizenRole(
      'actor-id',
      'target-id',
      'moderator',
      reason,
    )

    expect(result).toEqual({
      citizen_id: 'target-id',
      roles: ['citizen', 'moderator'],
      changed_role: 'moderator',
    })
    expect(sqlText(mockTxQueryRaw, 0)).toContain('pg_advisory_xact_lock')
    expect(sqlText(mockTxExecuteRaw, 0)).toContain('INSERT INTO citizen_role_grants')
    expect(sqlValues(mockTxExecuteRaw, 0)).toEqual(expect.arrayContaining([
      'moderator',
      'superadmin_dashboard',
      'actor-id',
    ]))
    expect(sqlText(mockTxExecuteRaw, 1)).toContain('INSERT INTO admin_audit_log')
    expect(sqlValues(mockTxExecuteRaw, 1)).toEqual(expect.arrayContaining([
      'role.grant',
      reason,
    ]))
    expect(mockTxCitizenUpdate).toHaveBeenCalledWith({
      where: { id: 'target-id' },
      data: { role: 'moderator' },
    })
    expect(mockTxExecuteRaw.mock.calls.every(([query]) => {
      const text = (query as { strings?: string[]; sql?: string })?.strings?.join('') ?? ''
      return !text.includes("UPDATE sessions\n      SET active_role = 'moderator'")
    })).toBe(true)
  })

  it('requires a meaningful reason before opening a mutation transaction', async () => {
    await expect(
      grantCitizenRole('actor-id', 'target-id', 'admin', 'corto'),
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_ROLE_REASON' })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('blocks duplicate grants instead of silently rewriting provenance', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { role: 'citizen', source: 'session_baseline' },
        { role: 'admin', source: 'superadmin_dashboard' },
      ])

    await expect(
      grantCitizenRole('actor-id', 'target-id', 'admin', 'Reasignación administrativa duplicada'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ROLE_ALREADY_GRANTED' })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })

  it('protects the canonical root even if another superadmin exists', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { role: 'citizen', source: 'session_baseline' },
        { role: 'superadmin', source: 'ctg_one_bootstrap' },
      ])

    await expect(
      revokeCitizenRole(
        'actor-id',
        'target-id',
        'superadmin',
        'Intento de transferir la autoridad raíz',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ROOT_SUPERADMIN_PROTECTED' })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
    expect(mockTxCitizenUpdate).not.toHaveBeenCalled()
  })

  it('preserves the last-superadmin guard for delegated superadmins', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { role: 'citizen', source: 'session_baseline' },
        { role: 'superadmin', source: 'superadmin_dashboard' },
      ])
      .mockResolvedValueOnce([{ total: 1n }])

    await expect(
      revokeCitizenRole(
        'actor-id',
        'target-id',
        'superadmin',
        'Revocación administrativa por cambio de funciones',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'LAST_SUPERADMIN_PROTECTED' })

    expect(mockTxExecuteRaw).not.toHaveBeenCalled()
  })

  it('revokes only the selected role, collapses its live sessions to citizen and audits the reason', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { role: 'citizen', source: 'session_baseline' },
        { role: 'moderator', source: 'superadmin_dashboard' },
      ])

    const reason = 'Finalizó la responsabilidad de moderación'
    const result = await revokeCitizenRole(
      'actor-id',
      'target-id',
      'moderator',
      reason,
    )

    expect(result).toEqual({
      citizen_id: 'target-id',
      roles: ['citizen'],
      changed_role: 'moderator',
    })
    expect(sqlText(mockTxExecuteRaw, 0)).toContain('UPDATE citizen_role_grants')
    expect(sqlText(mockTxExecuteRaw, 1)).toContain('UPDATE sessions')
    expect(sqlText(mockTxExecuteRaw, 1)).toContain("SET active_role = 'citizen'")
    expect(sqlText(mockTxExecuteRaw, 2)).toContain('INSERT INTO admin_audit_log')
    expect(sqlValues(mockTxExecuteRaw, 2)).toEqual(expect.arrayContaining([
      'role.revoke',
      reason,
    ]))
    expect(mockTxCitizenUpdate).toHaveBeenCalledWith({
      where: { id: 'target-id' },
      data: { role: 'citizen' },
    })
  })
})

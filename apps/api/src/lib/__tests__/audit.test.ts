const mockQueryRaw = jest.fn()

jest.mock('../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

import type { Prisma } from '@prisma/client'
import { recordAuditEvent } from '../audit'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('recordAuditEvent', () => {
  it('inserta un evento de auditoría con todos los campos', async () => {
    mockQueryRaw.mockResolvedValueOnce(undefined)

    await recordAuditEvent({
      actorId: 'mod-1',
      action: 'admin_archive_proposal',
      targetType: 'proposal',
      targetId: 'p1',
      result: 'success',
      reason: 'spam',
      metadata: { from: 'idea' },
    })

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    const sql = (mockQueryRaw.mock.calls[0][0] as Prisma.Sql).sql
    expect(sql).toContain('INSERT INTO admin_audit_log')
  })

  it('nunca lanza — un fallo al auditar no debe bloquear la acción que audita', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('db down'))

    await expect(recordAuditEvent({
      actorId: 'mod-1',
      action: 'admin_archive_proposal',
      targetType: 'proposal',
      targetId: 'p1',
      result: 'success',
    })).resolves.toBeUndefined()
  })
})

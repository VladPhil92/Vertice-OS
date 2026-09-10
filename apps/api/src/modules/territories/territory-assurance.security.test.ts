jest.mock('../../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  },
}))

import { prisma } from '../../lib/prisma'
import { decideTerritoryAssuranceRequest } from './territory-assurance.service'

const mockTransaction = prisma.$transaction as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe('territorial assurance reviewer separation', () => {
  it('forbids a privileged citizen from deciding their own residence assurance request', async () => {
    const citizenId = '22222222-2222-4222-8222-222222222222'
    const tx = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{
        id: '11111111-1111-4111-8111-111111111111',
        citizen_id: citizenId,
        territory_code: 'CO-MP-13001',
        territory_name: 'Cartagena de Indias',
        status: 'submitted',
        requested_level: 1,
        evidence_type: 'secure_document',
        submitted_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
        decision_reason: null,
        updated_at: new Date(),
        current_territory_code: 'CO-MP-13001',
      }]),
      $executeRaw: jest.fn(),
    }
    mockTransaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))

    await expect(decideTerritoryAssuranceRequest({
      actorId: citizenId,
      requestId: '11111111-1111-4111-8111-111111111111',
      decision: 'approve',
      reason: 'Intento de autoaprobación que debe fallar cerrado.',
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN',
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })
})

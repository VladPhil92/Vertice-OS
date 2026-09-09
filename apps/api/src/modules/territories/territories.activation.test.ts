jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))
jest.mock('../../lib/audit', () => ({ recordAuditEvent: jest.fn() }))
jest.mock('./territories.service', () => ({ getTerritory: jest.fn() }))

import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import { getTerritory } from './territories.service'
import {
  reviewActivationInterest,
  submitActivationInterest,
  withdrawActivationInterest,
} from './territories.activation'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockAudit = recordAuditEvent as jest.Mock
const mockGetTerritory = getTerritory as jest.Mock

const BASE_ROW = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  territory_code: 'CO-MP-13001',
  citizen_id: '550e8400-e29b-41d4-a716-446655440001',
  interest_role: 'ambassador',
  status: 'pending',
  message: 'Puedo ayudar a convocar vecinos.',
  reviewed_by: null,
  reviewed_at: null,
  created_at: new Date('2026-09-09T10:00:00Z'),
  updated_at: new Date('2026-09-09T10:00:00Z'),
}

beforeEach(() => {
  jest.resetAllMocks()
  mockGetTerritory.mockResolvedValue({ code: 'CO-MP-13001', level: 'district' })
  mockAudit.mockResolvedValue(undefined)
})

describe('submitActivationInterest', () => {
  it('fails closed when the citizen belongs to another territory', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ territory_code: 'CO-MP-05001' }])

    await expect(submitActivationInterest({
      citizenId: BASE_ROW.citizen_id,
      territoryCode: 'CO-MP-13001',
      interestRole: 'ambassador',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACTIVATION_INTEREST_TERRITORY_MISMATCH',
    })
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('creates a pending operational interest without granting authority', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ territory_code: 'CO-MP-13001' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([BASE_ROW])

    const result = await submitActivationInterest({
      citizenId: BASE_ROW.citizen_id,
      territoryCode: 'CO-MP-13001',
      interestRole: 'ambassador',
      message: BASE_ROW.message,
    })

    expect(result.status).toBe('pending')
    expect(result.authority_effect).toBe('none')
    expect(result.cohort_assignment_effect).toBe('none_without_separate_superadmin_action')
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'territory_activation_interest_submitted',
      metadata: expect.objectContaining({ authority_effect: 'none' }),
    }))
  })

  it('does not downgrade an already approved interest back to pending', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ territory_code: 'CO-MP-13001' }])
      .mockResolvedValueOnce([{ ...BASE_ROW, status: 'approved' }])

    const result = await submitActivationInterest({
      citizenId: BASE_ROW.citizen_id,
      territoryCode: 'CO-MP-13001',
      interestRole: 'ambassador',
    })

    expect(result.status).toBe('approved')
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    expect(mockAudit).not.toHaveBeenCalled()
  })
})

describe('withdrawActivationInterest', () => {
  it('withdraws only the caller-owned territorial interest', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...BASE_ROW, status: 'withdrawn' }])
    const result = await withdrawActivationInterest({
      citizenId: BASE_ROW.citizen_id,
      territoryCode: 'CO-MP-13001',
      interestRole: 'ambassador',
    })
    expect(result.status).toBe('withdrawn')
    expect(result.authority_effect).toBe('none')
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'territory_activation_interest_withdrawn' }))
  })

  it('returns 404 when there is no matching caller-owned interest', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(withdrawActivationInterest({
      citizenId: BASE_ROW.citizen_id,
      territoryCode: 'CO-MP-13001',
      interestRole: 'observer',
    })).rejects.toMatchObject({ statusCode: 404, code: 'ACTIVATION_INTEREST_NOT_FOUND' })
  })
})

describe('reviewActivationInterest', () => {
  it('rejects review of a withdrawn expression', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...BASE_ROW, status: 'withdrawn' }])
    await expect(reviewActivationInterest({
      actorId: '550e8400-e29b-41d4-a716-446655440002',
      interestId: BASE_ROW.id,
      status: 'approved',
      reason: 'Meets operational activation review criteria.',
    })).rejects.toMatchObject({ statusCode: 409, code: 'ACTIVATION_INTEREST_WITHDRAWN' })
  })

  it('fails closed if withdrawal wins the race after the preliminary read', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([BASE_ROW])
      .mockResolvedValueOnce([])

    await expect(reviewActivationInterest({
      actorId: '550e8400-e29b-41d4-a716-446655440002',
      interestId: BASE_ROW.id,
      status: 'approved',
      reason: 'Meets operational activation review criteria.',
    })).rejects.toMatchObject({ statusCode: 409, code: 'ACTIVATION_INTEREST_WITHDRAWN' })
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it('approves interest without assigning a cohort or any authority', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([BASE_ROW])
      .mockResolvedValueOnce([{ ...BASE_ROW, status: 'approved', reviewed_by: '550e8400-e29b-41d4-a716-446655440002' }])

    const result = await reviewActivationInterest({
      actorId: '550e8400-e29b-41d4-a716-446655440002',
      interestId: BASE_ROW.id,
      status: 'approved',
      reason: 'Meets operational activation review criteria.',
    })

    expect(result.status).toBe('approved')
    expect(result.authority_effect).toBe('none')
    expect(result.cohort_assignment_effect).toBe('none_without_separate_superadmin_action')
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'territory_activation_interest_reviewed',
      metadata: expect.objectContaining({ cohort_assignment_effect: 'none' }),
    }))
  })
})

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn() },
    externalIdentity: { findFirst: jest.fn() },
  },
}))

import { config } from '../../../config'
import { prisma } from '../../../lib/prisma'
import { getCivicIdentityAssurance } from '../identity-assurance.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  jest.resetAllMocks()
  config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(
    0,
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.length,
    'trusted_kyc',
  )
})

describe('getCivicIdentityAssurance', () => {
  it('fails closed when no assurance provider is configured', async () => {
    config.CIVIC_IDENTITY_ASSURANCE_PROVIDERS.splice(0)
    ;(prisma.citizen.findUnique as jest.Mock).mockResolvedValueOnce({
      id: CITIZEN_ID,
      verificationLevel: 2,
    })

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status.assured).toBe(false)
    expect(status.governance_eligible).toBe(false)
    expect(status.requirements.contact_verified).toBe(true)
    expect(status.requirements.trusted_identity_provider_linked).toBe(false)
    expect(prisma.externalIdentity.findFirst).not.toHaveBeenCalled()
  })

  it('does not treat a trusted provider as sufficient without verified contact', async () => {
    ;(prisma.citizen.findUnique as jest.Mock).mockResolvedValueOnce({
      id: CITIZEN_ID,
      verificationLevel: 1,
    })
    ;(prisma.externalIdentity.findFirst as jest.Mock).mockResolvedValueOnce({
      provider: 'trusted_kyc',
      createdAt: new Date('2026-09-02T20:00:00.000Z'),
    })

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status.assured).toBe(false)
    expect(status.requirements.contact_verified).toBe(false)
    expect(status.requirements.trusted_identity_provider_linked).toBe(true)
  })

  it('does not promote ordinary federation to civic identity assurance', async () => {
    ;(prisma.citizen.findUnique as jest.Mock).mockResolvedValueOnce({
      id: CITIZEN_ID,
      verificationLevel: 2,
    })
    ;(prisma.externalIdentity.findFirst as jest.Mock).mockResolvedValueOnce(null)

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status.assured).toBe(false)
    expect(prisma.externalIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          citizenId: CITIZEN_ID,
          provider: { in: ['trusted_kyc'] },
        }),
      }),
    )
  })

  it('marks a contact-verified citizen with a trusted provider as governance eligible', async () => {
    ;(prisma.citizen.findUnique as jest.Mock).mockResolvedValueOnce({
      id: CITIZEN_ID,
      verificationLevel: 2,
    })
    ;(prisma.externalIdentity.findFirst as jest.Mock).mockResolvedValueOnce({
      provider: 'trusted_kyc',
      createdAt: new Date('2026-09-02T20:00:00.000Z'),
    })

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status).toMatchObject({
      citizen_id: CITIZEN_ID,
      assured: true,
      status: 'assured',
      governance_eligible: true,
      verification_level: 2,
      provider: 'trusted_kyc',
      provider_linked_at: '2026-09-02T20:00:00.000Z',
      requirements: {
        contact_verified: true,
        trusted_identity_provider_linked: true,
      },
    })
  })

  it('returns 404 when the authenticated citizen no longer exists', async () => {
    ;(prisma.citizen.findUnique as jest.Mock).mockResolvedValueOnce(null)

    await expect(getCivicIdentityAssurance(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  })
})

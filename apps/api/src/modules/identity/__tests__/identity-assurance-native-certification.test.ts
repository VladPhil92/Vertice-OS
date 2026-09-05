const mockFindUnique = jest.fn()
const mockGetActiveProof = jest.fn()
const mockGetOperationalProviders = jest.fn()
const mockGetRegisteredNativeProviders = jest.fn()
const mockGetEvidenceCertifiedProviders = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: mockFindUnique },
  },
}))

jest.mock('../identity-proofing.service', () => ({
  getActiveCivicIdentityProof: mockGetActiveProof,
}))

jest.mock('../identity-proofing-provider-config', () => ({
  getOperationalCivicIdentityProviders: mockGetOperationalProviders,
}))

jest.mock('../identity-provider-registry', () => ({
  getRegisteredNativeCivicIdentityProviders: mockGetRegisteredNativeProviders,
}))

jest.mock('../identity-provider-external-certification.service', () => ({
  getActiveEvidenceCertifiedProviders: mockGetEvidenceCertifiedProviders,
}))

import { getCivicIdentityAssurance } from '../identity-assurance.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const VERIFF_PROOF = {
  provider: 'veriff',
  verified_at: new Date('2026-09-05T01:00:00.000Z'),
  expires_at: new Date('2027-09-05T01:00:00.000Z'),
}

beforeEach(() => {
  jest.resetAllMocks()
  mockFindUnique.mockResolvedValue({ id: CITIZEN_ID, verificationLevel: 2 })
  mockGetOperationalProviders.mockReturnValue(['veriff'])
  mockGetRegisteredNativeProviders.mockReturnValue(['veriff'])
  mockGetActiveProof.mockResolvedValue(VERIFF_PROOF)
})

describe('P1.0 native provider governance certification gate', () => {
  it('keeps an active native proof fail-closed without durable canary evidence', async () => {
    mockGetEvidenceCertifiedProviders.mockResolvedValue([])

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status.assured).toBe(false)
    expect(status.governance_eligible).toBe(false)
    expect(status.provider).toBe('veriff')
    expect(status.requirements).toMatchObject({
      contact_verified: true,
      provider_ingress_operational: true,
      active_identity_proof: true,
      provider_external_certified: false,
    })
  })

  it('permits governance only after an active evidence-backed certification exists', async () => {
    mockGetEvidenceCertifiedProviders.mockResolvedValue(['veriff'])

    const status = await getCivicIdentityAssurance(CITIZEN_ID)

    expect(status.assured).toBe(true)
    expect(status.governance_eligible).toBe(true)
    expect(status.requirements.provider_external_certified).toBe(true)
  })
})

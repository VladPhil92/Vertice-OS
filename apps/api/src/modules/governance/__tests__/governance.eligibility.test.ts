const mockQueryRaw = jest.fn()

jest.mock('../../../config', () => ({
  config: {
    CIVIC_IDENTITY_ASSURANCE_PROVIDERS: ['trusted_kyc'],
    CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: JSON.stringify({
      trusted_kyc: { test: 'test-proofing-adapter-secret-32-chars!!' },
    }),
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

import { getGovernanceEligibilityPreflight } from '../governance.eligibility'

const AT = new Date('2026-09-10T18:00:00.000Z')
const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111'
const CITIZEN_ID = '22222222-2222-4222-8222-222222222222'
const ASSURANCE_ID = '33333333-3333-4333-8333-333333333333'
const IDENTITY_ID = '44444444-4444-4444-8444-444444444444'

const BASE_ROW = {
  proposal_id: PROPOSAL_ID,
  scope: 'city',
  proposal_territory_code: 'CO-MP-13001',
  proposal_parent_code: 'CO-DP-13',
  proposal_locality_id: null,
  proposal_neighborhood: null,
  voting_starts_at: null,
  citizen_exists: true,
  verification_level: 2,
  citizen_territory_code: 'CO-MP-13001',
  citizen_parent_code: 'CO-DP-13',
  citizen_locality_id: 1,
  citizen_neighborhood: 'Manga',
  current_assurance_request_id: ASSURANCE_ID,
  current_assurance_level: 1,
  current_assurance_status: 'verified',
  current_assurance_verified_at: new Date('2026-09-01T00:00:00.000Z'),
  current_assurance_expires_at: new Date('2027-09-01T00:00:00.000Z'),
  current_identity_proof_id: IDENTITY_ID,
  current_identity_provider: 'trusted_kyc',
  current_identity_verified_at: new Date('2026-09-01T00:00:00.000Z'),
  current_identity_expires_at: new Date('2027-09-01T00:00:00.000Z'),
  roll_exists: false,
  roll_member: false,
  frozen_at: null,
  frozen_identity_proof_id: null,
  frozen_identity_provider: null,
  frozen_identity_verified_at: null,
  frozen_identity_expires_at: null,
  frozen_territory_code: null,
  frozen_territory_assurance_level: null,
  frozen_territory_assurance_request_id: null,
  frozen_territory_verified_at: null,
  frozen_territory_assurance_expires_at: null,
}

beforeEach(() => jest.clearAllMocks())

describe('Phase 7G.2 governance eligibility preflight', () => {
  it('admits a city citizen only with current identity and fresh matching residence assurance', async () => {
    mockQueryRaw.mockResolvedValueOnce([BASE_ROW])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: true,
      authority: 'current_assurance',
      reason_code: 'ELIGIBLE_CURRENT_ASSURANCE',
      identity_assurance: { satisfied: true, proof_id: IDENTITY_ID },
      territory_assurance: { satisfied: true, request_id: ASSURANCE_ID, scope_match: true },
      frozen_electorate: { required: false },
    })
  })

  it('reports an expired residence before the electorate is frozen', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      current_assurance_expires_at: new Date('2026-09-10T17:59:59.000Z'),
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: false,
      authority: 'none',
      reason_code: 'TERRITORY_ASSURANCE_EXPIRED',
      territory_assurance: { expired: true, satisfied: false },
    })
  })

  it('rejects a current verified residence outside the proposal scope', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      citizen_territory_code: 'CO-MP-05001',
      citizen_parent_code: 'CO-DP-05',
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'TERRITORY_SCOPE_MISMATCH',
      territory_assurance: { scope_match: false },
    })
  })

  it('keeps national participation identity-based before freeze', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      scope: 'national',
      proposal_territory_code: null,
      proposal_parent_code: null,
      citizen_territory_code: null,
      citizen_parent_code: null,
      current_assurance_request_id: null,
      current_assurance_level: 0,
      current_assurance_status: null,
      current_assurance_verified_at: null,
      current_assurance_expires_at: null,
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: true,
      reason_code: 'ELIGIBLE_CURRENT_ASSURANCE',
      identity_assurance: { satisfied: true },
      territory_assurance: { required: false, satisfied: true },
    })
  })

  it('requires current civic identity assurance before freeze', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      current_identity_proof_id: null,
      current_identity_provider: null,
      current_identity_verified_at: null,
      current_identity_expires_at: null,
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'IDENTITY_ASSURANCE_REQUIRED',
      identity_assurance: { satisfied: false },
    })
  })

  it('switches authority to the frozen electorate after voting opens even if current assurance later expires', async () => {
    const frozenAt = new Date('2026-09-10T17:00:00.000Z')
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      voting_starts_at: frozenAt,
      roll_exists: true,
      roll_member: true,
      frozen_at: frozenAt,
      frozen_identity_proof_id: IDENTITY_ID,
      frozen_identity_provider: 'trusted_kyc',
      frozen_identity_verified_at: new Date('2026-09-01T00:00:00.000Z'),
      frozen_identity_expires_at: new Date('2027-09-01T00:00:00.000Z'),
      frozen_territory_code: 'CO-MP-13001',
      frozen_territory_assurance_level: 1,
      frozen_territory_assurance_request_id: ASSURANCE_ID,
      frozen_territory_verified_at: new Date('2025-09-10T17:00:00.000Z'),
      frozen_territory_assurance_expires_at: new Date('2026-09-10T17:30:00.000Z'),
      current_assurance_expires_at: new Date('2026-09-10T17:30:00.000Z'),
      current_assurance_status: 'revoked',
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: true,
      authority: 'frozen_electorate',
      reason_code: 'ELIGIBLE_FROZEN_ELECTORATE',
      frozen_electorate: { required: true, available: true, member: true, provenance_available: true },
    })
  })

  it('fails closed when voting started without an electorate snapshot', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      voting_starts_at: new Date('2026-09-10T17:00:00.000Z'),
      roll_exists: false,
      roll_member: false,
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'VOTER_ROLL_UNAVAILABLE',
      frozen_electorate: { required: true, available: false, member: false },
    })
  })

  it('rejects a citizen absent from the frozen electorate', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      ...BASE_ROW,
      voting_starts_at: new Date('2026-09-10T17:00:00.000Z'),
      roll_exists: true,
      roll_member: false,
    }])

    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'NOT_IN_FROZEN_ELECTORATE',
    })
  })

  it('fails with 404 for an unknown proposal', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getGovernanceEligibilityPreflight(PROPOSAL_ID, CITIZEN_ID, AT)).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROPOSAL_NOT_FOUND',
    })
  })
})

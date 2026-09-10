jest.mock('../../lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

import { createHash } from 'node:crypto'
import { prisma } from '../../lib/prisma'
import {
  TERRITORY_ASSURANCE_RENEWAL_WINDOW_DAYS,
  TERRITORY_ASSURANCE_VALIDITY_DAYS,
  decideTerritoryAssuranceRequest,
  getMyTerritoryAssurance,
  listTerritoryAssuranceRequests,
  submitTerritoryAssuranceRequest,
} from './territory-assurance.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

const REQUEST = {
  id: '11111111-1111-4111-8111-111111111111',
  citizen_id: '22222222-2222-4222-8222-222222222222',
  territory_code: 'CO-MP-13001',
  territory_name: 'Cartagena de Indias',
  status: 'submitted',
  requested_level: 1,
  evidence_type: 'secure_document',
  submitted_at: new Date('2026-09-10T17:00:00.000Z'),
  verified_at: null,
  expires_at: null,
  reviewed_at: null,
  reviewed_by: null,
  decision_reason: null,
  updated_at: new Date('2026-09-10T17:00:00.000Z'),
}

function installTransaction(queryResponses: unknown[][]) {
  const tx = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn().mockResolvedValue(1),
  }
  for (const response of queryResponses) tx.$queryRaw.mockResolvedValueOnce(response)
  mockTransaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx))
  return tx
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('Phase 7G.2 assurance validity policy', () => {
  it('keeps the explicit 365-day validity and 30-day renewal window constants', () => {
    expect(TERRITORY_ASSURANCE_VALIDITY_DAYS).toBe(365)
    expect(TERRITORY_ASSURANCE_RENEWAL_WINDOW_DAYS).toBe(30)
  })
})

describe('getMyTerritoryAssurance', () => {
  it('exposes self-asserted home state and its pending request without granting governance authority', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        citizen_id: REQUEST.citizen_id,
        territory_code: REQUEST.territory_code,
        territory_name: REQUEST.territory_name,
        territory_level: 'district',
        territory_assurance_level: 0,
        territory_assurance_source: 'self_asserted',
        territory_verified_at: null,
        territory_assurance_request_id: null,
        current_request_status: null,
        current_request_verified_at: null,
        current_request_expires_at: null,
      }])
      .mockResolvedValueOnce([REQUEST])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_code: 'CO-MP-13001',
      territory_assurance_level: 0,
      effective_territory_assurance_level: 0,
      territory_assurance_effective: false,
      pending_request: { id: REQUEST.id, status: 'submitted' },
      governance_effect: 'none_without_verified_residence',
    })
  })

  it('reports the territorial prerequisite only while the current verified request is unexpired', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        citizen_id: REQUEST.citizen_id,
        territory_code: REQUEST.territory_code,
        territory_name: REQUEST.territory_name,
        territory_level: 'district',
        territory_assurance_level: 1,
        territory_assurance_source: 'assurance:secure_document',
        territory_verified_at: new Date('2026-09-01T00:00:00.000Z'),
        territory_assurance_request_id: REQUEST.id,
        current_request_status: 'verified',
        current_request_verified_at: new Date('2026-09-01T00:00:00.000Z'),
        current_request_expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      }])
      .mockResolvedValueOnce([])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_assurance_level: 1,
      effective_territory_assurance_level: 1,
      territory_assurance_effective: true,
      renewal_required: false,
      pending_request: null,
      governance_effect: 'territorial_prerequisite_satisfied',
    })
  })

  it('fails closed for governance when the persisted aggregate points at an expired request', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        citizen_id: REQUEST.citizen_id,
        territory_code: REQUEST.territory_code,
        territory_name: REQUEST.territory_name,
        territory_level: 'district',
        territory_assurance_level: 1,
        territory_assurance_source: 'assurance:secure_document',
        territory_verified_at: new Date('2025-09-01T00:00:00.000Z'),
        territory_assurance_request_id: REQUEST.id,
        current_request_status: 'verified',
        current_request_verified_at: new Date('2025-09-01T00:00:00.000Z'),
        current_request_expires_at: new Date(Date.now() - 1000),
      }])
      .mockResolvedValueOnce([])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_assurance_level: 1,
      effective_territory_assurance_level: 0,
      territory_assurance_effective: false,
      governance_effect: 'none_expired_residence',
    })
  })

  it('marks a still-valid request inside the renewal window', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{
        citizen_id: REQUEST.citizen_id,
        territory_code: REQUEST.territory_code,
        territory_name: REQUEST.territory_name,
        territory_level: 'district',
        territory_assurance_level: 1,
        territory_assurance_source: 'assurance:secure_document',
        territory_verified_at: new Date(),
        territory_assurance_request_id: REQUEST.id,
        current_request_status: 'verified',
        current_request_verified_at: new Date(),
        current_request_expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      }])
      .mockResolvedValueOnce([])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_assurance_effective: true,
      renewal_required: true,
    })
  })

  it('fails when the citizen does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).rejects.toMatchObject({
      code: 'CITIZEN_NOT_FOUND',
      statusCode: 404,
    })
  })
})

describe('submitTerritoryAssuranceRequest', () => {
  const evidenceReference = 'vault:residence/opaque-7G2-123456'

  it('requires a selected home municipality before accepting evidence', async () => {
    installTransaction([[
      { citizen_id: REQUEST.citizen_id, territory_code: null, territory_level: null, territory_assurance_request_id: null },
    ]])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).rejects.toMatchObject({
      code: 'TERRITORY_ASSURANCE_REQUIRES_HOME_TERRITORY',
      statusCode: 409,
    })
  })

  it('rejects a non-municipal home binding', async () => {
    installTransaction([[
      { citizen_id: REQUEST.citizen_id, territory_code: 'CO-DP-13', territory_level: 'department', territory_assurance_request_id: null },
    ]])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_HOME_LEVEL_UNSUPPORTED' })
  })

  it('stores only a SHA-256 digest of the opaque evidence reference', async () => {
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district', territory_assurance_request_id: null }],
      [REQUEST],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).resolves.toMatchObject({ request: { id: REQUEST.id }, reused: false, renewal: false })

    const insertSql = tx.$queryRaw.mock.calls[1][0] as { values?: unknown[] }
    const expectedDigest = createHash('sha256').update(evidenceReference, 'utf8').digest('hex')
    expect(insertSql.values).toContain(expectedDigest)
    expect(insertSql.values).not.toContain(evidenceReference)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('reuses a current verification when more than 30 days remain', async () => {
    const current = {
      ...REQUEST,
      status: 'verified',
      verified_at: new Date(),
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    }
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district', territory_assurance_request_id: REQUEST.id }],
      [current],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).resolves.toMatchObject({ request: { id: REQUEST.id }, reused: true, renewal: false })
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('opens a renewal request when the current verification is inside the renewal window or expired', async () => {
    const renewal = { ...REQUEST, id: '55555555-5555-4555-8555-555555555555' }
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district', territory_assurance_request_id: REQUEST.id }],
      [],
      [renewal],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).resolves.toMatchObject({ request: { id: renewal.id }, reused: false, renewal: true })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('reuses an already submitted review rather than creating duplicate pending state', async () => {
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district', territory_assurance_request_id: null }],
      [],
      [REQUEST],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).resolves.toMatchObject({ request: { id: REQUEST.id }, reused: true })
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('fails closed if a database conflict does not map to a submitted request', async () => {
    installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district', territory_assurance_request_id: null }],
      [],
      [],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_REQUEST_CONFLICT' })
  })
})

describe('decideTerritoryAssuranceRequest', () => {
  const actorId = '33333333-3333-4333-8333-333333333333'
  const reason = 'Evidencia revisada y consistente con el territorio declarado.'

  it('approves only when the citizen still has the same home territory and issues bounded validity', async () => {
    const verified = {
      ...REQUEST,
      status: 'verified',
      verified_at: new Date('2026-09-10T18:00:00.000Z'),
      expires_at: new Date('2027-09-10T18:00:00.000Z'),
      reviewed_at: new Date(),
      reviewed_by: actorId,
      decision_reason: reason,
    }
    const tx = installTransaction([
      [{ ...REQUEST, current_territory_code: REQUEST.territory_code, current_assurance_request_id: null }],
      [verified],
      [{ id: REQUEST.citizen_id }],
    ])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'approve',
      reason,
    })).resolves.toMatchObject({
      id: REQUEST.id,
      status: 'verified',
      verified_at: verified.verified_at,
      expires_at: verified.expires_at,
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    const approvalSql = String((tx.$queryRaw.mock.calls[1][0] as { strings?: readonly string[] }).strings?.join(' '))
    expect(approvalSql).toContain("INTERVAL '365 days'")
  })

  it('supersedes the previous verified request when a renewal is approved', async () => {
    const renewalId = '55555555-5555-4555-8555-555555555555'
    const renewalRequest = { ...REQUEST, id: renewalId }
    const verifiedRenewal = {
      ...renewalRequest,
      status: 'verified',
      verified_at: new Date(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }
    const tx = installTransaction([
      [{ ...renewalRequest, current_territory_code: REQUEST.territory_code, current_assurance_request_id: REQUEST.id }],
      [verifiedRenewal],
      [{ id: REQUEST.id }],
      [{ id: REQUEST.citizen_id }],
    ])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: renewalId,
      decision: 'approve',
      reason,
    })).resolves.toMatchObject({ id: renewalId, status: 'verified' })
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it('refuses approval when home territory changed after submission', async () => {
    installTransaction([[
      { ...REQUEST, current_territory_code: 'CO-MP-05001', current_assurance_request_id: null },
    ]])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'approve',
      reason,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_HOME_TERRITORY_CHANGED' })
  })

  it('rejects a submitted request without mutating citizen assurance', async () => {
    const rejected = { ...REQUEST, status: 'rejected', reviewed_at: new Date(), reviewed_by: actorId }
    const tx = installTransaction([
      [{ ...REQUEST, current_territory_code: REQUEST.territory_code, current_assurance_request_id: null }],
      [rejected],
    ])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'reject',
      reason: 'La evidencia no permite acreditar residencia de forma suficiente.',
    })).resolves.toMatchObject({ status: 'rejected' })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('revokes only the assurance linked to the exact verified request', async () => {
    const verified = {
      ...REQUEST,
      status: 'verified',
      verified_at: new Date(),
      expires_at: new Date(Date.now() + 100000),
    }
    const revoked = { ...verified, status: 'revoked', reviewed_at: new Date(), reviewed_by: actorId }
    const tx = installTransaction([
      [{ ...verified, current_territory_code: REQUEST.territory_code, current_assurance_request_id: REQUEST.id }],
      [revoked],
    ])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'revoke',
      reason: 'La verificación territorial fue revocada tras revisión administrativa.',
    })).resolves.toMatchObject({ status: 'revoked' })

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid lifecycle transitions', async () => {
    installTransaction([[
      { ...REQUEST, current_territory_code: REQUEST.territory_code, current_assurance_request_id: null },
    ]])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'revoke',
      reason,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_INVALID_TRANSITION' })
  })

  it('fails closed when the account behind a request was deleted', async () => {
    installTransaction([[
      { ...REQUEST, citizen_id: null, current_territory_code: null, current_assurance_request_id: null },
    ]])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'approve',
      reason,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_CITIZEN_UNAVAILABLE' })
  })
})

describe('listTerritoryAssuranceRequests', () => {
  it('returns the operational review queue with validity metadata', async () => {
    mockQueryRaw.mockResolvedValueOnce([REQUEST])
    await expect(listTerritoryAssuranceRequests({ status: 'submitted', limit: 25 })).resolves.toEqual([REQUEST])
  })
})

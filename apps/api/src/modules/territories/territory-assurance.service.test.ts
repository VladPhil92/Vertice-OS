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
      }])
      .mockResolvedValueOnce([REQUEST])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_code: 'CO-MP-13001',
      territory_assurance_level: 0,
      pending_request: { id: REQUEST.id, status: 'submitted' },
      governance_effect: 'none_without_verified_residence',
    })
  })

  it('reports the territorial prerequisite only after assurance is effective', async () => {
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
      }])
      .mockResolvedValueOnce([])

    await expect(getMyTerritoryAssurance(REQUEST.citizen_id)).resolves.toMatchObject({
      territory_assurance_level: 1,
      pending_request: null,
      governance_effect: 'territorial_prerequisite_satisfied',
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
  const evidenceReference = 'vault:residence/opaque-7G1-123456'

  it('requires a selected home municipality before accepting evidence', async () => {
    installTransaction([[
      { citizen_id: REQUEST.citizen_id, territory_code: null, territory_level: null },
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
      { citizen_id: REQUEST.citizen_id, territory_code: 'CO-DP-13', territory_level: 'department' },
    ]])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_HOME_LEVEL_UNSUPPORTED' })
  })

  it('stores only a SHA-256 digest of the opaque evidence reference', async () => {
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district' }],
      [REQUEST],
    ])

    await expect(submitTerritoryAssuranceRequest({
      citizenId: REQUEST.citizen_id,
      evidenceType: 'secure_document',
      evidenceReference,
    })).resolves.toMatchObject({ request: { id: REQUEST.id }, reused: false })

    const insertSql = tx.$queryRaw.mock.calls[1][0] as { values?: unknown[] }
    const expectedDigest = createHash('sha256').update(evidenceReference, 'utf8').digest('hex')
    expect(insertSql.values).toContain(expectedDigest)
    expect(insertSql.values).not.toContain(evidenceReference)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('reuses an already active request rather than creating duplicate assurance state', async () => {
    const tx = installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district' }],
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

  it('fails closed if a database conflict does not map to an active request', async () => {
    installTransaction([
      [{ citizen_id: REQUEST.citizen_id, territory_code: REQUEST.territory_code, territory_level: 'district' }],
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

  it('approves only when the citizen still has the same home territory', async () => {
    const verified = {
      ...REQUEST,
      status: 'verified',
      reviewed_at: new Date(),
      reviewed_by: actorId,
      decision_reason: reason,
    }
    const tx = installTransaction([
      [{ ...REQUEST, current_territory_code: REQUEST.territory_code }],
      [verified],
      [{ id: REQUEST.citizen_id }],
    ])

    await expect(decideTerritoryAssuranceRequest({
      actorId,
      requestId: REQUEST.id,
      decision: 'approve',
      reason,
    })).resolves.toMatchObject({ id: REQUEST.id, status: 'verified' })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3)
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('refuses approval when home territory changed after submission', async () => {
    installTransaction([[
      { ...REQUEST, current_territory_code: 'CO-MP-05001' },
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
      [{ ...REQUEST, current_territory_code: REQUEST.territory_code }],
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
    const verified = { ...REQUEST, status: 'verified' }
    const revoked = { ...REQUEST, status: 'revoked', reviewed_at: new Date(), reviewed_by: actorId }
    const tx = installTransaction([
      [{ ...verified, current_territory_code: REQUEST.territory_code }],
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
      { ...REQUEST, current_territory_code: REQUEST.territory_code },
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
      { ...REQUEST, citizen_id: null, current_territory_code: null },
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
  it('returns the operational review queue', async () => {
    mockQueryRaw.mockResolvedValueOnce([REQUEST])
    await expect(listTerritoryAssuranceRequests({ status: 'submitted', limit: 25 })).resolves.toEqual([REQUEST])
  })
})

// Mock AI service functions before any imports
const mockCivicQuery     = jest.fn()
const mockAnalyzeTerr    = jest.fn()
const mockSynthesize     = jest.fn()
const mockDraftPolicy    = jest.fn()
const mockAnalyzeLegal   = jest.fn()

jest.mock('../ai.service', () => ({
  civicQuery:        mockCivicQuery,
  analyzeTerritorial: mockAnalyzeTerr,
  synthesizeDebate:  mockSynthesize,
  draftPolicy:       mockDraftPolicy,
  analyzeLegal:      mockAnalyzeLegal,
}))

// Territorial + governance service deps
const mockGetReportById   = jest.fn()
const mockGetProposalById = jest.fn()

jest.mock('../../territorial/territorial.service', () => ({
  getReportById: mockGetReportById,
}))

jest.mock('../../governance/governance.service', () => ({
  getProposalById: mockGetProposalById,
}))

// Auth middleware — always pass in tests
jest.mock('../../../middleware/auth', () => ({
  requireVerified: jest.fn((_req: unknown, _rep: unknown, done: () => void) => done()),
}))

import Fastify from 'fastify'
import { aiRoutes } from '../ai.routes'

const CITIZEN_ID = 'aaaa0000-0000-0000-0000-000000000001'

async function buildApp() {
  const app = Fastify()
  // Inject a minimal citizen into every request
  app.addHook('onRequest', (req, _reply, done) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(req as any).citizen = { sub: CITIZEN_ID, did: 'did:vertice:test', lvl: 2, role: 'citizen' }
    done()
  })
  await app.register(aiRoutes, { prefix: '/ai' })
  return app
}

let app: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => { app = await buildApp() })
afterAll(async () => { await app.close() })
beforeEach(() => jest.resetAllMocks())

// ── POST /ai/query ─────────────────────────────────────────────────────────────

describe('POST /ai/query', () => {
  it('returns 200 with AI response', async () => {
    const aiResult = { response: 'ok', intent: 'info', agent_used: 'civic', confidence: 0.9, audit_id: 'a1' }
    mockCivicQuery.mockResolvedValue(aiResult)

    const res = await app.inject({
      method: 'POST',
      url: '/ai/query',
      payload: { message: 'hola Vértice' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(aiResult)
    expect(mockCivicQuery).toHaveBeenCalledWith(expect.objectContaining({
      message: 'hola Vértice',
      citizen_id: CITIZEN_ID,
    }))
  })

  it('returns 400 for empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/query', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /ai/legal/analyze ─────────────────────────────────────────────────────

describe('POST /ai/legal/analyze', () => {
  it('returns 200 with legal analysis', async () => {
    const legalResult = {
      legal_type: 'derecho_petición',
      urgency: 'high',
      rights_affected: [],
      target_entity: { name: '', type: '', address: '', email: '', phone: '', contact_person: '' },
      response_deadline_days: 15,
      document_draft: '...',
      legal_orientation: '...',
      alternative_remedies: [],
      legal_basis: [],
      next_steps: [],
      audit_id: 'a5',
    }
    mockAnalyzeLegal.mockResolvedValue(legalResult)

    const res = await app.inject({
      method: 'POST',
      url: '/ai/legal/analyze',
      payload: { description: 'El alcalde no responde mis peticiones' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual(legalResult)
  })

  it('returns 400 when description is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/legal/analyze', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})

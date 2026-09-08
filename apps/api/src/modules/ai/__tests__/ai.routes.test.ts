// Mock AI service functions before any imports
const mockCivicQuery = jest.fn()
const mockAnalyzeTerr = jest.fn()
const mockSynthesize = jest.fn()
const mockDraftPolicy = jest.fn()
const mockAnalyzeLegal = jest.fn()

jest.mock('../ai.service', () => ({
  civicQuery: mockCivicQuery,
  analyzeTerritorial: mockAnalyzeTerr,
  synthesizeDebate: mockSynthesize,
  draftPolicy: mockDraftPolicy,
  analyzeLegal: mockAnalyzeLegal,
}))

const mockRunWithAiUsageQuota = jest.fn(async (_citizenId: string, operation: () => Promise<unknown>) => operation())
jest.mock('../../billing/billing.usage.service', () => ({
  runWithAiUsageQuota: mockRunWithAiUsageQuota,
}))

// Territorial + governance service deps
const mockGetReportById = jest.fn()
const mockGetProposalById = jest.fn()

jest.mock('../../territorial/territorial.service', () => ({
  getReportById: mockGetReportById,
}))

jest.mock('../../governance/governance.service', () => ({
  getProposalById: mockGetProposalById,
}))

// Cache (Redis-backed) — evita abrir una conexión real durante los tests
const mockGetCache = jest.fn()
const mockSetCache = jest.fn()
const mockDelCache = jest.fn()

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: {
    PROFILE: 300,
    SESSION: 60,
    REPORT: 120,
    STATS: 600,
    CONVERSATION: 14_400,
    NOTIFICATION: 604_800,
  },
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
beforeEach(() => {
  jest.clearAllMocks()
  mockRunWithAiUsageQuota.mockImplementation(async (_citizenId: string, operation: () => Promise<unknown>) => operation())
})

describe('POST /ai/query', () => {
  it('returns 200 with AI response and passes through the server-side quota boundary', async () => {
    const aiResult = { response: 'ok', intent: 'info', agent_used: 'civic', confidence: 0.9, audit_id: 'a1' }
    mockCivicQuery.mockResolvedValue(aiResult)

    const res = await app.inject({
      method: 'POST',
      url: '/ai/query',
      payload: { message: 'hola Vértice' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ...aiResult, session_id: expect.any(String) })
    expect(mockRunWithAiUsageQuota).toHaveBeenCalledWith(CITIZEN_ID, expect.any(Function))
    expect(mockCivicQuery).toHaveBeenCalledWith(expect.objectContaining({
      message: 'hola Vértice',
      citizen_id: CITIZEN_ID,
    }))
  })

  it('returns 429 without calling the AI service when plan capacity is exhausted', async () => {
    mockRunWithAiUsageQuota.mockRejectedValueOnce(Object.assign(new Error('Has alcanzado el límite mensual de solicitudes de IA de tu plan.'), {
      statusCode: 429,
      code: 'AI_MONTHLY_QUOTA_EXCEEDED',
    }))

    const res = await app.inject({
      method: 'POST',
      url: '/ai/query',
      payload: { message: 'consulta adicional' },
    })

    expect(res.statusCode).toBe(429)
    expect(mockCivicQuery).not.toHaveBeenCalled()
  })

  it('returns 400 for empty body without consuming quota', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/query', payload: {} })
    expect(res.statusCode).toBe(400)
    expect(mockRunWithAiUsageQuota).not.toHaveBeenCalled()
  })
})

describe('POST /ai/legal/analyze', () => {
  it('returns 200 with legal analysis through the quota boundary', async () => {
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
    expect(mockRunWithAiUsageQuota).toHaveBeenCalledWith(CITIZEN_ID, expect.any(Function))
  })

  it('returns 400 when description is missing without consuming quota', async () => {
    const res = await app.inject({ method: 'POST', url: '/ai/legal/analyze', payload: {} })
    expect(res.statusCode).toBe(400)
    expect(mockRunWithAiUsageQuota).not.toHaveBeenCalled()
  })
})

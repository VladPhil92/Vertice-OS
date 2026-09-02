jest.mock('../../../lib/redis', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}))

const mockListCases = jest.fn()
const mockGetCase = jest.fn()
const mockGetCaseForReport = jest.fn()
const mockAnalyze = jest.fn()
const mockProposal = jest.fn()
const mockControl = jest.fn()

jest.mock('../workflow.service', () => ({
  listCivicCases: mockListCases,
  getCivicCase: mockGetCase,
  getCivicCaseForReport: mockGetCaseForReport,
  analyzeReportWorkflow: mockAnalyze,
  createProposalFromReport: mockProposal,
  createControlFromReport: mockControl,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DID = `did:vertice:${CITIZEN_ID}`
const REPORT_ID = '660e8400-e29b-41d4-a716-446655440001'
const CASE_ID = '770e8400-e29b-41d4-a716-446655440002'

let verifiedToken: string

const MOCK_CASE = {
  id: CASE_ID,
  stage: 'analysis',
  stored_stage: 'analysis',
  created_at: '2026-09-02T20:00:00.000Z',
  updated_at: '2026-09-02T21:00:00.000Z',
  report: {
    id: REPORT_ID,
    title: 'Falla recurrente del alumbrado público en el sector',
    category: 'servicios_publicos',
    status: 'open',
    neighborhood: 'Manga',
    created_at: '2026-09-02T20:00:00.000Z',
  },
  analysis: { audit_id: 'audit-1', result: { analysis: 'Patrón territorial' } },
  proposal: null,
  control: null,
}

beforeAll(async () => {
  await app.ready()
  verifiedToken = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})

afterAll(() => app.close())

beforeEach(() => {
  jest.resetAllMocks()
})

describe('civic workflow routes', () => {
  it('requires authentication to list civic cases', async () => {
    const res = await app.inject({ method: 'GET', url: '/workflows/cases' })
    expect(res.statusCode).toBe(401)
  })

  it('lists the authenticated citizen civic cases', async () => {
    mockListCases.mockResolvedValueOnce([MOCK_CASE])

    const res = await app.inject({
      method: 'GET',
      url: '/workflows/cases?limit=5',
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).count).toBe(1)
    expect(mockListCases).toHaveBeenCalledWith(CITIZEN_ID, 5)
  })

  it('returns the workflow attached to an owned report', async () => {
    mockGetCaseForReport.mockResolvedValueOnce(MOCK_CASE)

    const res = await app.inject({
      method: 'GET',
      url: `/workflows/reports/${REPORT_ID}`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).case.id).toBe(CASE_ID)
    expect(mockGetCaseForReport).toHaveBeenCalledWith(CITIZEN_ID, REPORT_ID)
  })

  it('analyzes a report and returns its updated civic case', async () => {
    mockAnalyze.mockResolvedValueOnce({
      analysis: { analysis: 'Patrón territorial', audit_id: 'audit-1' },
      case: MOCK_CASE,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/reports/${REPORT_ID}/analyze`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload).case.stage).toBe('analysis')
    expect(mockAnalyze).toHaveBeenCalledWith(CITIZEN_ID, REPORT_ID)
  })

  it('propagates report ownership failures without calling another module', async () => {
    mockAnalyze.mockRejectedValueOnce(
      Object.assign(new Error('Solo puedes escalar reportes creados por ti'), {
        statusCode: 403,
        code: 'NOT_REPORT_OWNER',
      }),
    )

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/reports/${REPORT_ID}/analyze`,
      headers: { authorization: `Bearer ${verifiedToken}` },
    })

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.payload).code).toBe('NOT_REPORT_OWNER')
  })

  it('rejects an invalid proposal scope before orchestration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/workflows/reports/${REPORT_ID}/proposal`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { scope: 'planet' },
    })

    expect(res.statusCode).toBe(400)
    expect(mockProposal).not.toHaveBeenCalled()
  })

  it('creates a proposal from a report through the workflow contract', async () => {
    mockProposal.mockResolvedValueOnce({
      proposal: { id: '880e8400-e29b-41d4-a716-446655440003' },
      policy_draft: { draft: 'Borrador', audit_id: 'audit-2' },
      case: { ...MOCK_CASE, stage: 'proposal' },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/reports/${REPORT_ID}/proposal`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: { scope: 'city' },
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).case.stage).toBe('proposal')
    expect(mockProposal).toHaveBeenCalledWith(CITIZEN_ID, REPORT_ID, expect.objectContaining({ scope: 'city' }))
  })

  it('creates a public-control document from a report', async () => {
    mockControl.mockResolvedValueOnce({
      document: { id: '990e8400-e29b-41d4-a716-446655440004' },
      case: { ...MOCK_CASE, stage: 'control' },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/workflows/reports/${REPORT_ID}/control`,
      headers: { authorization: `Bearer ${verifiedToken}` },
      payload: {},
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.payload).case.stage).toBe('control')
    expect(mockControl).toHaveBeenCalledWith(CITIZEN_ID, REPORT_ID, expect.any(Object))
  })
})

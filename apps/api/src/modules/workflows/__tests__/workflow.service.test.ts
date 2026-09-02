const mockQueryRaw = jest.fn()
const mockAnalyzeTerritorial = jest.fn()
const mockDraftPolicy = jest.fn()
const mockCreateProposal = jest.fn()
const mockCreateLegalDocument = jest.fn()
const mockGetReportById = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

jest.mock('../../ai/ai.service', () => ({
  analyzeTerritorial: mockAnalyzeTerritorial,
  draftPolicy: mockDraftPolicy,
}))

jest.mock('../../governance/governance.service', () => ({
  createProposal: mockCreateProposal,
}))

jest.mock('../../legal/legal.service', () => ({
  createLegalDocument: mockCreateLegalDocument,
}))

jest.mock('../../territorial/territorial.service', () => ({
  getReportById: mockGetReportById,
}))

import {
  analyzeReportWorkflow,
  createControlFromReport,
  createProposalFromReport,
  getCivicCase,
  getCivicCaseForReport,
  listCivicCases,
} from '../workflow.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440999'
const REPORT_ID = '660e8400-e29b-41d4-a716-446655440001'
const CASE_ID = '770e8400-e29b-41d4-a716-446655440002'
const PROPOSAL_ID = '880e8400-e29b-41d4-a716-446655440003'
const LEGAL_ID = '990e8400-e29b-41d4-a716-446655440004'

const REPORT = {
  id: REPORT_ID,
  citizen_id: CITIZEN_ID,
  category: 'transporte',
  subcategory: null,
  title: 'Cruce peatonal inseguro y sin señalización en Manga',
  description: 'El cruce concentra alto flujo peatonal y carece de señalización suficiente para proteger a residentes y estudiantes.',
  neighborhood: 'Manga',
  locality_id: 1,
  address_reference: 'Avenida principal de Manga',
  urgency_score: 0.82,
  sentiment_score: null,
  cluster_id: null,
  status: 'open',
  assigned_to: null,
  media_urls: ['https://example.com/evidence.jpg'],
  ipfs_hash: null,
  lat: 10.4101,
  lng: -75.5364,
  created_at: new Date('2026-09-02T20:00:00.000Z'),
  updated_at: new Date('2026-09-02T20:30:00.000Z'),
  resolved_at: null,
}

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    citizen_id: CITIZEN_ID,
    source_report_id: REPORT_ID,
    proposal_id: null,
    legal_document_id: null,
    stage: 'reported',
    territorial_analysis: null,
    territorial_analysis_audit_id: null,
    policy_draft: null,
    policy_draft_audit_id: null,
    created_at: new Date('2026-09-02T20:00:00.000Z'),
    updated_at: new Date('2026-09-02T20:30:00.000Z'),
    report_title: REPORT.title,
    report_category: REPORT.category,
    report_status: REPORT.status,
    report_neighborhood: REPORT.neighborhood,
    report_created_at: REPORT.created_at,
    proposal_title: null,
    proposal_status: null,
    proposal_scope: null,
    proposal_voting_ends_at: null,
    legal_type: null,
    legal_status: null,
    legal_urgency: null,
    legal_submitted_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('workflow service', () => {
  it('lists civic cases and derives downstream voting state from the linked proposal', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      caseRow({
        proposal_id: PROPOSAL_ID,
        proposal_title: 'Mejorar la seguridad del cruce peatonal',
        proposal_status: 'voting',
        proposal_scope: 'neighborhood',
        proposal_voting_ends_at: new Date('2026-09-04T20:00:00.000Z'),
        policy_draft_audit_id: 'audit-policy',
      }),
    ])

    const cases = await listCivicCases(CITIZEN_ID, 5)

    expect(cases).toHaveLength(1)
    expect(cases[0].stage).toBe('voting')
    expect(cases[0].proposal).toEqual(expect.objectContaining({
      id: PROPOSAL_ID,
      status: 'voting',
      policy_draft_audit_id: 'audit-policy',
    }))
  })

  it('derives control_drafting while the linked legal document is still a draft', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      caseRow({
        legal_document_id: LEGAL_ID,
        legal_type: 'derecho_peticion',
        legal_status: 'draft',
        legal_urgency: 'alta',
        territorial_analysis_audit_id: 'audit-analysis',
      }),
    ])

    const cases = await listCivicCases(CITIZEN_ID)

    expect(cases[0].stage).toBe('control_drafting')
    expect(cases[0].control).toEqual(expect.objectContaining({ id: LEGAL_ID, status: 'draft' }))
  })

  it('returns 404 when an owned civic case does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getCivicCase(CITIZEN_ID, CASE_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_CASE_NOT_FOUND',
    })
  })

  it('rejects access to a report owned by another citizen before querying civic cases', async () => {
    mockGetReportById.mockResolvedValueOnce({ ...REPORT, citizen_id: OTHER_CITIZEN_ID })

    await expect(getCivicCaseForReport(CITIZEN_ID, REPORT_ID)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_REPORT_OWNER',
    })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('returns null when an owned report has not been escalated yet', async () => {
    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getCivicCaseForReport(CITIZEN_ID, REPORT_ID)).resolves.toBeNull()
  })

  it('analyzes an owned report, persists the AI audit and returns the refreshed case', async () => {
    const analysis = {
      analysis: 'El reporte evidencia un riesgo de seguridad vial concentrado en el sector.',
      clusters: [],
      priorities: ['señalización'],
      audit_id: 'audit-analysis',
    }

    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CASE_ID }])
      .mockResolvedValueOnce([caseRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        caseRow({
          stage: 'analysis',
          territorial_analysis: analysis,
          territorial_analysis_audit_id: analysis.audit_id,
        }),
      ])
    mockAnalyzeTerritorial.mockResolvedValueOnce(analysis)

    const result = await analyzeReportWorkflow(CITIZEN_ID, REPORT_ID)

    expect(mockAnalyzeTerritorial).toHaveBeenCalledWith(expect.objectContaining({
      citizen_id: CITIZEN_ID,
      neighborhood: 'Manga',
      reports: [expect.objectContaining({ id: REPORT_ID, urgency_score: 0.82 })],
    }))
    expect(result.analysis.audit_id).toBe('audit-analysis')
    expect(result.case.stage).toBe('analysis')
    expect(result.case.analysis?.audit_id).toBe('audit-analysis')
    expect(mockQueryRaw).toHaveBeenCalledTimes(4)
  })

  it('fails closed if a civic case cannot be materialized after insert', async () => {
    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CASE_ID }])
      .mockResolvedValueOnce([])

    await expect(analyzeReportWorkflow(CITIZEN_ID, REPORT_ID)).rejects.toMatchObject({
      statusCode: 500,
      code: 'CIVIC_CASE_CREATE_FAILED',
    })
    expect(mockAnalyzeTerritorial).not.toHaveBeenCalled()
  })

  it('rejects creation of a second proposal for the same civic case', async () => {
    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([caseRow({ proposal_id: PROPOSAL_ID })])

    await expect(createProposalFromReport(CITIZEN_ID, REPORT_ID, { scope: 'city' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CASE_PROPOSAL_EXISTS',
    })
    expect(mockDraftPolicy).not.toHaveBeenCalled()
    expect(mockCreateProposal).not.toHaveBeenCalled()
  })

  it('creates a proposal from a report and maps transporte to movilidad', async () => {
    const policy = {
      draft: 'Propuesta de intervención integral para mejorar señalización, visibilidad y prioridad peatonal en el cruce identificado por la ciudadanía.',
      audit_id: 'audit-policy',
    }
    const proposal = {
      id: PROPOSAL_ID,
      author_id: CITIZEN_ID,
      title: 'Cruce peatonal seguro para Manga',
      status: 'idea',
    }

    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CASE_ID }])
      .mockResolvedValueOnce([caseRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        caseRow({
          proposal_id: PROPOSAL_ID,
          proposal_title: proposal.title,
          proposal_status: 'idea',
          proposal_scope: 'neighborhood',
          policy_draft: policy,
          policy_draft_audit_id: policy.audit_id,
        }),
      ])
    mockDraftPolicy.mockResolvedValueOnce(policy)
    mockCreateProposal.mockResolvedValueOnce(proposal)

    const result = await createProposalFromReport(CITIZEN_ID, REPORT_ID, {
      scope: 'neighborhood',
      title: proposal.title,
    })

    expect(mockDraftPolicy).toHaveBeenCalledWith(expect.objectContaining({
      category: 'movilidad',
      scope: 'neighborhood',
      territory: 'Manga',
    }))
    expect(mockCreateProposal).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      title: proposal.title,
      category: 'movilidad',
      scope: 'neighborhood',
      executive_summary: expect.stringContaining('alto flujo peatonal'),
    }))
    expect(result.proposal.id).toBe(PROPOSAL_ID)
    expect(result.case.stage).toBe('proposal')
  })

  it('uses report context when the AI policy draft is too short', async () => {
    mockGetReportById.mockResolvedValueOnce({ ...REPORT, category: 'categoria_no_mapeada' })
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([caseRow({ report_category: 'categoria_no_mapeada' })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        caseRow({
          proposal_id: PROPOSAL_ID,
          proposal_title: 'Solución ciudadana',
          proposal_status: 'idea',
          proposal_scope: 'city',
        }),
      ])
    mockDraftPolicy.mockResolvedValueOnce({ draft: 'Borrador breve', audit_id: 'audit-short' })
    mockCreateProposal.mockResolvedValueOnce({ id: PROPOSAL_ID })

    await createProposalFromReport(CITIZEN_ID, REPORT_ID, { scope: 'city' })

    expect(mockCreateProposal).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      category: 'otro',
      description: expect.stringContaining('Contexto ciudadano:'),
    }))
  })

  it('rejects creation of a second public-control document for the same case', async () => {
    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([caseRow({ legal_document_id: LEGAL_ID })])

    await expect(createControlFromReport(CITIZEN_ID, REPORT_ID, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'CASE_CONTROL_EXISTS',
    })
    expect(mockCreateLegalDocument).not.toHaveBeenCalled()
  })

  it('creates public control from report evidence and returns control_drafting', async () => {
    const document = {
      id: LEGAL_ID,
      legal_type: 'derecho_peticion',
      status: 'draft',
      urgency: 'alta',
    }

    mockGetReportById.mockResolvedValueOnce(REPORT)
    mockQueryRaw
      .mockResolvedValueOnce([{ id: CASE_ID }])
      .mockResolvedValueOnce([caseRow()])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        caseRow({
          legal_document_id: LEGAL_ID,
          legal_type: document.legal_type,
          legal_status: document.status,
          legal_urgency: document.urgency,
        }),
      ])
    mockCreateLegalDocument.mockResolvedValueOnce(document)

    const result = await createControlFromReport(CITIZEN_ID, REPORT_ID, {})

    expect(mockCreateLegalDocument).toHaveBeenCalledWith(CITIZEN_ID, expect.objectContaining({
      situation_description: REPORT.description,
      location: REPORT.address_reference,
      evidence_urls: REPORT.media_urls,
      category: 'transporte',
      evidence_description: expect.stringContaining(REPORT_ID),
    }))
    expect(result.document.id).toBe(LEGAL_ID)
    expect(result.case.stage).toBe('control_drafting')
  })
})

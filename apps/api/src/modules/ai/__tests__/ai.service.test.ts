// Mock global fetch before importing the service
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import {
  civicQuery,
  analyzeTerritorial,
  synthesizeDebate,
  draftPolicy,
  analyzeLegal,
} from '../ai.service'

beforeEach(() => jest.resetAllMocks())

function okResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function errResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(text),
  } as unknown as Response
}

describe('civicQuery', () => {
  it('returns parsed response on success', async () => {
    const payload = { response: 'ok', intent: 'info', agent_used: 'civic', confidence: 0.9, audit_id: 'a1' }
    mockFetch.mockResolvedValue(okResponse(payload))

    const result = await civicQuery({ message: 'hola' })
    expect(result).toEqual(payload)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('throws a 502 error when AI service returns non-ok', async () => {
    mockFetch.mockResolvedValue(errResponse(500, 'Internal error'))

    await expect(civicQuery({ message: 'hola' })).rejects.toMatchObject({
      statusCode: 502,
      code: 'AI_SERVICE_ERROR',
    })
  })
})

describe('analyzeTerritorial', () => {
  it('calls /territorial/analyze and returns result', async () => {
    const payload = { analysis: 'ok', urgency_level: 'high', report_count: 2, audit_id: 'a2' }
    mockFetch.mockResolvedValue(okResponse(payload))

    const result = await analyzeTerritorial({ reports: [] })
    expect(result).toEqual(payload)
  })
})

describe('synthesizeDebate', () => {
  it('calls /governance/synthesize and returns result', async () => {
    const payload = { synthesis: 'ok', comment_count: 3, audit_id: 'a3' }
    mockFetch.mockResolvedValue(okResponse(payload))

    const result = await synthesizeDebate({
      proposal_title: 'title',
      proposal_description: 'desc',
      category: 'infrastructure',
      scope: 'city',
    })
    expect(result).toEqual(payload)
  })
})

describe('draftPolicy', () => {
  it('calls /governance/draft-policy and returns result', async () => {
    const payload = { draft: 'draft text', audit_id: 'a4' }
    mockFetch.mockResolvedValue(okResponse(payload))

    const result = await draftPolicy({ citizen_demand: 'parques', category: 'infrastructure', scope: 'city' })
    expect(result).toEqual(payload)
  })
})

describe('analyzeLegal', () => {
  it('throws when fetch fails', async () => {
    mockFetch.mockResolvedValue(errResponse(422, 'Unprocessable'))

    await expect(analyzeLegal({ description: 'desc' })).rejects.toMatchObject({
      statusCode: 502,
    })
  })
})

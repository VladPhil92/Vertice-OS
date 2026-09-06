import {
  CIVIC_SCORE_MAX,
  scoreCivicAction,
  type CivicActionScoringInput,
} from '../civic-actions.score'

function longText(size: number): string {
  return 'x'.repeat(size)
}

function baseInput(overrides: Partial<CivicActionScoringInput> = {}): CivicActionScoringInput {
  return {
    status: 'proposed',
    evidence_count: 0,
    external_evidence_count: 0,
    hashed_evidence_count: 0,
    corroborations: 0,
    disputes: 0,
    collaborators_count: 0,
    beneficiaries_estimate: null,
    problem: '',
    objective: '',
    result_summary: null,
    neighborhood: null,
    target_date: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('civic reputation v1', () => {
  it('keeps confidence separate from the 100-point reputation formula', () => {
    const result = scoreCivicAction({
      status: 'verified',
      evidence_count: 3,
      external_evidence_count: 1,
      hashed_evidence_count: 3,
      corroborations: 5,
      disputes: 0,
      collaborators_count: 4,
      beneficiaries_estimate: 200,
      problem: longText(120),
      objective: longText(80),
      result_summary: longText(80),
      neighborhood: 'Manga',
      target_date: '2026-12-31',
      created_at: new Date(Date.now() - 35 * 86_400_000).toISOString(),
    })

    expect(result.score_version).toBe('civic-reputation-v1')
    expect(result.civic_score).toBe(93)
    expect(result.confidence_score).toBe(100)
    expect(result.confidence_level).toBe('high')
    expect(result.evidence_level).toBe(4)
    expect(result.score_dimensions).toEqual({
      evidence: 21,
      results: 20,
      impact: 13,
      fulfillment: 15,
      validation: 10,
      continuity: 5,
      transparency: 5,
      collaboration: 4,
    })
    expect(Object.values(CIVIC_SCORE_MAX).reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('bounds citizen validation and lets disputes reduce confidence without negative reputation', () => {
    const result = scoreCivicAction({
      status: 'result_declared',
      evidence_count: 1,
      external_evidence_count: 0,
      hashed_evidence_count: 0,
      corroborations: 2,
      disputes: 3,
      collaborators_count: 0,
      beneficiaries_estimate: 10,
      problem: longText(90),
      objective: longText(60),
      result_summary: longText(50),
      neighborhood: 'Olaya Herrera',
      target_date: null,
      created_at: new Date().toISOString(),
    })

    expect(result.score_dimensions.validation).toBe(2)
    expect(result.score_dimensions.validation).toBeLessThanOrEqual(10)
    expect(result.confidence_score).toBe(0)
    expect(result.confidence_level).toBe('low')
    expect(result.evidence_level).toBe(1)
  })

  it('does not manufacture external or VERTICE verification from uploads alone', () => {
    const result = scoreCivicAction({
      status: 'in_progress',
      evidence_count: 4,
      external_evidence_count: 2,
      hashed_evidence_count: 4,
      corroborations: 4,
      disputes: 0,
      collaborators_count: 3,
      beneficiaries_estimate: 100,
      problem: longText(100),
      objective: longText(70),
      result_summary: null,
      neighborhood: 'Getsemaní',
      target_date: '2026-12-31',
      created_at: new Date(Date.now() - 15 * 86_400_000).toISOString(),
    })

    expect(result.evidence_level).toBe(2)
    expect(result.confidence_score).toBeGreaterThan(0)
    expect(result.civic_score).toBeLessThanOrEqual(100)
  })

  const resultStatusCases: Array<[CivicActionScoringInput['status'], number]> = [
    ['verified', 20],
    ['under_verification', 16],
    ['result_declared', 13],
    ['in_progress', 7],
    ['preparing', 4],
    ['proposed', 2],
    ['disputed', 7],
    ['no_evidence', 4],
    ['not_completed', 2],
    ['cancelled', 0],
  ]

  it.each(resultStatusCases)('maps %s to its explicit result score', (status, expected) => {
    const result = scoreCivicAction(baseInput({ status }))
    expect(result.score_dimensions.results).toBe(expected)
  })

  const impactCases: Array<[number | null, number]> = [
    [null, 2],
    [500, 15],
    [200, 13],
    [50, 11],
    [10, 8],
    [1, 5],
    [0, 2],
  ]

  it.each(impactCases)('maps beneficiary estimate %s to bounded impact points', (beneficiaries, expected) => {
    const result = scoreCivicAction(baseInput({ beneficiaries_estimate: beneficiaries }))
    expect(result.score_dimensions.impact).toBe(expected)
  })

  it('distinguishes expired deadlines from active or malformed target dates', () => {
    const expiredInProgress = scoreCivicAction(baseInput({
      status: 'in_progress',
      target_date: '2000-01-01',
    }))
    const expiredProposed = scoreCivicAction(baseInput({
      status: 'proposed',
      target_date: '2000-01-01',
    }))
    const malformedPreparing = scoreCivicAction(baseInput({
      status: 'preparing',
      target_date: 'not-a-date',
    }))

    expect(expiredInProgress.score_dimensions.fulfillment).toBe(3)
    expect(expiredProposed.score_dimensions.fulfillment).toBe(1)
    expect(malformedPreparing.score_dimensions.fulfillment).toBe(4)
  })

  it('applies continuity bands to non-verified civic actions', () => {
    const now = Date.now()
    const scoreAtAge = (days: number) => scoreCivicAction(baseInput({
      status: 'proposed',
      created_at: new Date(now - days * 86_400_000).toISOString(),
    })).score_dimensions.continuity

    expect(scoreAtAge(35)).toBe(5)
    expect(scoreAtAge(15)).toBe(4)
    expect(scoreAtAge(8)).toBe(3)
    expect(scoreAtAge(1)).toBe(1)
  })

  it('recognizes externally referenced evidence under review without calling it verified', () => {
    const result = scoreCivicAction(baseInput({
      status: 'under_verification',
      evidence_count: 1,
      external_evidence_count: 1,
      hashed_evidence_count: 1,
      corroborations: 2,
      collaborators_count: 8,
    }))

    expect(result.evidence_level).toBe(3)
    expect(result.confidence_score).toBe(46)
    expect(result.confidence_level).toBe('medium')
    expect(result.score_dimensions.collaboration).toBe(5)
    expect(result.score_dimensions.results).toBe(16)
  })
})

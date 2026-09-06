import { CIVIC_SCORE_MAX, scoreCivicAction } from '../civic-actions.score'

function longText(size: number): string {
  return 'x'.repeat(size)
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
})

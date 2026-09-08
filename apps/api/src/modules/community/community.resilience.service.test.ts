jest.mock('./community.service', () => ({
  listCommunityFeed: jest.fn(),
}))

import { listCommunityFeed } from './community.service'
import { listCommunityFeedResilient } from './community.resilience.service'

const mockListCommunityFeed = listCommunityFeed as jest.Mock

const report = {
  id: 'report-1',
  type: 'report',
  actor: { id: 'citizen-1', display_name: 'Ciudadano', neighborhood: 'Manga', actor_kind: 'citizen', organization: null, public_profile: true, platform_reputation_score: 0 },
  title: 'Reporte',
  summary: 'Resumen',
  category: 'infraestructura',
  status: 'open',
  neighborhood: 'Manga',
  evidence_count: 1,
  verification_state: 'evidence_backed',
  civic_score: 40,
  score_dimensions: { evidence: 10, results: 4, impact: 8, validation: 0, transparency: 3, collaboration: 0, continuity: 2, confidence: 13 },
  community_validation: { corroborations: 0, disputes: 0, total: 0 },
  created_at: '2026-09-08T10:00:00.000Z',
  updated_at: '2026-09-08T12:00:00.000Z',
  href: '/dashboard/reports/report-1',
}

const proposal = {
  ...report,
  id: 'proposal-1',
  type: 'proposal',
  title: 'Propuesta',
  updated_at: '2026-09-08T13:00:00.000Z',
  href: '/dashboard/proposals/proposal-1',
}

beforeEach(() => jest.resetAllMocks())

describe('listCommunityFeedResilient', () => {
  it('returns the normal feed with complete availability when the primary read succeeds', async () => {
    mockListCommunityFeed.mockResolvedValueOnce([report, proposal])

    const result = await listCommunityFeedResilient({ limit: 20 })

    expect(result.data).toHaveLength(2)
    expect(result.availability).toEqual({ reports: 'available', proposals: 'available', degraded: false })
  })

  it('keeps proposals visible when the report source fails', async () => {
    mockListCommunityFeed
      .mockRejectedValueOnce(new Error('combined read failed'))
      .mockRejectedValueOnce(new Error('reports unavailable'))
      .mockResolvedValueOnce([proposal])

    const result = await listCommunityFeedResilient({ limit: 20 })

    expect(result.data).toEqual([proposal])
    expect(result.availability).toEqual({ reports: 'unavailable', proposals: 'available', degraded: true })
  })

  it('keeps reports visible when the proposal source fails', async () => {
    mockListCommunityFeed
      .mockRejectedValueOnce(new Error('combined read failed'))
      .mockResolvedValueOnce([report])
      .mockRejectedValueOnce(new Error('proposals unavailable'))

    const result = await listCommunityFeedResilient({ limit: 20 })

    expect(result.data).toEqual([report])
    expect(result.availability).toEqual({ reports: 'available', proposals: 'unavailable', degraded: true })
  })

  it('propagates the original failure when every source is unavailable', async () => {
    const primary = new Error('database unavailable')
    mockListCommunityFeed
      .mockRejectedValueOnce(primary)
      .mockRejectedValueOnce(new Error('reports unavailable'))
      .mockRejectedValueOnce(new Error('proposals unavailable'))

    await expect(listCommunityFeedResilient({ limit: 20 })).rejects.toBe(primary)
  })
})

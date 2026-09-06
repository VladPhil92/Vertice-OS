const mockQueryRaw = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

import { getCivicEvidenceAttentionQueue } from '../dashboard.attention.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('dashboard evidence attention queue', () => {
  it('maps prioritized civic actions to direct resolution links', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Recuperación participativa del parque de Manga',
        status: 'result_declared',
        updated_at: new Date('2026-09-06T18:00:00.000Z'),
        total_matches: 7n,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Seguimiento a luminarias comunitarias',
        status: 'disputed',
        updated_at: new Date('2026-09-05T18:00:00.000Z'),
        total_matches: 7n,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Jornada de recuperación del entorno',
        status: 'in_progress',
        updated_at: new Date('2026-09-04T18:00:00.000Z'),
        total_matches: 7n,
      },
    ])

    const result = await getCivicEvidenceAttentionQueue(CITIZEN_ID)

    expect(result.total).toBe(7)
    expect(result.items).toEqual([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Recuperación participativa del parque de Manga',
        status: 'result_declared',
        updated_at: '2026-09-06T18:00:00.000Z',
        reason: 'evidence_required',
        reason_label: 'El resultado necesita evidencia admisible.',
        href: '/dashboard/community/actions/11111111-1111-4111-8111-111111111111',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Seguimiento a luminarias comunitarias',
        status: 'disputed',
        updated_at: '2026-09-05T18:00:00.000Z',
        reason: 'evidence_required',
        reason_label: 'La evidencia fue cuestionada o sigue siendo insuficiente.',
        href: '/dashboard/community/actions/22222222-2222-4222-8222-222222222222',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Jornada de recuperación del entorno',
        status: 'in_progress',
        updated_at: '2026-09-04T18:00:00.000Z',
        reason: 'evidence_required',
        reason_label: 'La gestión está en curso sin evidencia admisible.',
        href: '/dashboard/community/actions/33333333-3333-4333-8333-333333333333',
      },
    ])
  })

  it('returns an empty fail-safe queue when no civic action needs evidence', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getCivicEvidenceAttentionQueue(CITIZEN_ID)).resolves.toEqual({
      total: 0,
      items: [],
    })
  })
})

const mockQueryRaw = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

import { getCivicActionResolutionPlan } from '../dashboard.resolution.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('dashboard civic action resolution plan', () => {
  it('maps action lifecycle states to the exact next owner step', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Recuperación del parque disputada',
        status: 'disputed',
        updated_at: new Date('2026-09-06T18:00:00.000Z'),
        evidence_count: 2n,
        next_step: 'reopen_execution',
        total_matches: 6n,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Resultado comunitario pendiente de soporte',
        status: 'result_declared',
        updated_at: new Date('2026-09-05T18:00:00.000Z'),
        evidence_count: 0n,
        next_step: 'attach_evidence',
        total_matches: 6n,
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Jornada documentada lista para cierre',
        status: 'in_progress',
        updated_at: new Date('2026-09-04T18:00:00.000Z'),
        evidence_count: 3n,
        next_step: 'declare_result',
        total_matches: 6n,
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        title: 'Gestión en ejecución sin soporte',
        status: 'in_progress',
        updated_at: new Date('2026-09-03T18:00:00.000Z'),
        evidence_count: 0n,
        next_step: 'attach_evidence',
        total_matches: 6n,
      },
    ])

    const result = await getCivicActionResolutionPlan(CITIZEN_ID)

    expect(result.total).toBe(6)
    expect(result.items).toEqual([
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        next_step: 'reopen_execution',
        next_step_label: 'Reabrir ejecución',
        priority: 'urgent',
        evidence_count: 2,
        href: '/dashboard/community/actions/11111111-1111-4111-8111-111111111111',
      }),
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        next_step: 'attach_evidence',
        next_step_label: 'Adjuntar evidencia del resultado',
        priority: 'high',
        evidence_count: 0,
      }),
      expect.objectContaining({
        id: '33333333-3333-4333-8333-333333333333',
        next_step: 'declare_result',
        next_step_label: 'Declarar resultado',
        priority: 'normal',
        evidence_count: 3,
      }),
      expect.objectContaining({
        id: '44444444-4444-4444-8444-444444444444',
        next_step: 'attach_evidence',
        next_step_label: 'Adjuntar evidencia',
        priority: 'normal',
        evidence_count: 0,
      }),
    ])

    expect(result.items[0]?.follow_up_label).toMatch(/evidencia nueva o corregida/i)
    expect(result.items[1]?.follow_up_label).toMatch(/lista para revisión/i)
    expect(result.items[2]?.follow_up_label).toMatch(/podrán pasar a revisión/i)
    expect(result.items[3]?.follow_up_label).toMatch(/declara el resultado/i)
  })

  it('returns an empty fail-safe plan when there are no owner steps to resolve', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getCivicActionResolutionPlan(CITIZEN_ID)).resolves.toEqual({
      total: 0,
      items: [],
    })
  })
})

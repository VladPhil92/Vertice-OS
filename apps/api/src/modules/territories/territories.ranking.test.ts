jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

import { prisma } from '../../lib/prisma'
import { getNationalActivationRanking } from './territories.ranking'

const mockQueryRaw = prisma.$queryRaw as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

function row(overrides: Record<string, unknown> = {}) {
  return {
    code: 'CO-MP-13001', external_code: '13001', name: 'Cartagena de Indias', level: 'municipality',
    parent_code: 'CO-DP-13', country_code: 'CO', slug: 'cartagena-de-indias',
    activation_status: 'available', source: 'dane_divipola', source_version: 'MGN_2025', activated_at: null,
    registered_citizens: 0n, active_citizens_30d: 0n, civic_actions_30d: 0n,
    verified_actions_90d: 0n, reports_30d: 0n, proposals_30d: 0n,
    ...overrides,
  }
}

describe('getNationalActivationRanking', () => {
  it('scores, sorts by momentum descending and slices to the requested limit', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      row({ code: 'CO-MP-05001', name: 'Medellín', registered_citizens: 2n }),
      row({
        code: 'CO-MP-13001', name: 'Cartagena de Indias',
        registered_citizens: 100n, active_citizens_30d: 100n, civic_actions_30d: 100n,
        verified_actions_90d: 100n, reports_30d: 100n, proposals_30d: 100n,
      }),
    ])

    const result = await getNationalActivationRanking(1)
    expect(result).toHaveLength(1)
    expect(result[0]?.code).toBe('CO-MP-13001')
    expect(result[0]?.momentum_score).toBe(100)
    expect(result[0]?.recommended_status).toBe('verified_network')
  })

  it('breaks a momentum tie alphabetically by name', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      row({ code: 'CO-MP-05001', name: 'Zipaquirá' }),
      row({ code: 'CO-MP-13001', name: 'Aracataca' }),
    ])

    const result = await getNationalActivationRanking(25)
    expect(result.map((r) => r.name)).toEqual(['Aracataca', 'Zipaquirá'])
  })

  it('bounds the requested limit to the 1-100 range', async () => {
    mockQueryRaw.mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => row({ code: `CO-MP-${i}` })))

    const result = await getNationalActivationRanking(1000)
    expect(result).toHaveLength(5)
  })
})

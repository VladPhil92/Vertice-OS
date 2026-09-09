jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))
jest.mock('./territories.service', () => ({
  getTerritory: jest.fn(),
}))

import { prisma } from '../../lib/prisma'
import { getTerritory } from './territories.service'
import { getTerritoryFeed } from './territories.feed'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockGetTerritory = getTerritory as jest.Mock

beforeEach(() => {
  jest.resetAllMocks()
})

describe('getTerritoryFeed', () => {
  it('rejects a territory level that does not support a feed', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-DP-13', level: 'department' })

    await expect(getTerritoryFeed('CO-DP-13')).rejects.toMatchObject({
      statusCode: 400,
      code: 'TERRITORY_FEED_LEVEL_UNSUPPORTED',
    })
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('reports an empty state when there is no activity yet', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-MP-13001', level: 'municipality' })
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const feed = await getTerritoryFeed('CO-MP-13001')
    expect(feed.empty_state).toBe('Sé una de las primeras personas en activar esta comunidad en VÉRTICE.')
    expect(feed.actions).toEqual([])
  })

  it('clears the empty state once any activity stream has entries', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-MP-13001', level: 'district' })
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'a1', title: 'Acción', category: 'infra', neighborhood: null, status: 'in_progress', created_at: new Date(), updated_at: new Date() }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const feed = await getTerritoryFeed('CO-MP-13001', 5)
    expect(feed.empty_state).toBeNull()
    expect(feed.actions).toHaveLength(1)
  })

  it('bounds the requested limit to the 1-30 range', async () => {
    mockGetTerritory.mockResolvedValueOnce({ code: 'CO-MP-13001', level: 'municipality' })
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

    await getTerritoryFeed('CO-MP-13001', 999)
    expect(mockQueryRaw).toHaveBeenCalledTimes(3)
  })
})

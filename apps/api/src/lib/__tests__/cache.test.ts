const mockGet = jest.fn()
const mockSet = jest.fn()
const mockDel = jest.fn()

jest.mock('../../redis', () => ({
  redis: {
    get: mockGet,
    set: mockSet,
    del: mockDel,
  },
}))

import { getCache, setCache, delCache, TTL } from '../cache'

beforeEach(() => jest.resetAllMocks())

describe('getCache', () => {
  it('returns parsed value when key exists', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ x: 1 }))
    const result = await getCache<{ x: number }>('ns', 'id')
    expect(result).toEqual({ x: 1 })
    expect(mockGet).toHaveBeenCalledWith('vertice:ns:id')
  })

  it('returns null when key is missing', async () => {
    mockGet.mockResolvedValue(null)
    expect(await getCache('ns', 'missing')).toBeNull()
  })

  it('returns null on invalid JSON', async () => {
    mockGet.mockResolvedValue('{bad json}')
    expect(await getCache('ns', 'id')).toBeNull()
  })
})

describe('setCache', () => {
  it('calls redis.set with correct key, serialized value, and TTL', async () => {
    mockSet.mockResolvedValue('OK')
    await setCache('ns', 'id', { x: 1 }, 60)
    expect(mockSet).toHaveBeenCalledWith('vertice:ns:id', JSON.stringify({ x: 1 }), 'EX', 60)
  })
})

describe('delCache', () => {
  it('calls redis.del with correct key', async () => {
    mockDel.mockResolvedValue(1)
    await delCache('ns', 'id')
    expect(mockDel).toHaveBeenCalledWith('vertice:ns:id')
  })
})

describe('TTL constants', () => {
  it('has expected values', () => {
    expect(TTL.PROFILE).toBe(300)
    expect(TTL.SESSION).toBe(60)
    expect(TTL.REPORT).toBe(120)
    expect(TTL.STATS).toBe(600)
  })
})

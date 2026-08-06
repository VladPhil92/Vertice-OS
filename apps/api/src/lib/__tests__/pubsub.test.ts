const mockRedisPublish = jest.fn().mockResolvedValue(1)

jest.mock('../redis', () => ({
  redis: {
    ping:    jest.fn().mockResolvedValue('PONG'),
    get:     jest.fn().mockResolvedValue(null),
    set:     jest.fn().mockResolvedValue('OK'),
    del:     jest.fn().mockResolvedValue(1),
    on:      jest.fn(),
    publish: mockRedisPublish,
  },
}))

import { publish } from '../pubsub'

beforeEach(() => jest.clearAllMocks())

// ── publish() ─────────────────────────────────────────────────────────────────

describe('publish', () => {
  it('calls redis.publish with a vertice:-prefixed channel', async () => {
    await publish('territorial', 'report:created', { id: 'r1' })
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'vertice:territorial',
      expect.any(String),
    )
  })

  it('serializes the event as valid JSON', async () => {
    await publish('governance', 'proposal:endorsed', { proposal_id: 'p1' })
    const [, raw] = mockRedisPublish.mock.calls[0] as [string, string]
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('includes channel, type, payload, and ts fields', async () => {
    const payload = { proposal_id: 'p1', endorsement_count: 5 }
    await publish('governance', 'proposal:endorsed', payload)
    const [, raw] = mockRedisPublish.mock.calls[0] as [string, string]
    const event = JSON.parse(raw)
    expect(event.channel).toBe('governance')
    expect(event.type).toBe('proposal:endorsed')
    expect(event.payload).toEqual(payload)
    expect(typeof event.ts).toBe('number')
  })

  it('timestamp is within the current second', async () => {
    const before = Date.now()
    await publish('system', 'ping', {})
    const after = Date.now()
    const [, raw] = mockRedisPublish.mock.calls[0] as [string, string]
    const { ts } = JSON.parse(raw) as { ts: number }
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('forwards complex payload objects faithfully', async () => {
    const payload = { id: 'r1', status: 'open', urgency_score: 0.8, nested: { a: 1 } }
    await publish('territorial', 'report:status_changed', payload)
    const [, raw] = mockRedisPublish.mock.calls[0] as [string, string]
    expect(JSON.parse(raw).payload).toEqual(payload)
  })

  it('publishes to the system channel correctly', async () => {
    await publish('system', 'health:check', { uptime: 9000 })
    expect(mockRedisPublish).toHaveBeenCalledWith('vertice:system', expect.any(String))
  })

  it('propagates redis.publish errors to the caller', async () => {
    mockRedisPublish.mockRejectedValueOnce(new Error('Redis connection lost'))
    await expect(publish('territorial', 'report:created', {})).rejects.toThrow('Redis connection lost')
  })
})

jest.mock('../../lib/prisma', () => ({
  prisma: { $executeRaw: jest.fn(), $queryRaw: jest.fn() },
}))

jest.mock('../../lib/redis', () => ({
  redis: {
    lpush: jest.fn(),
    ltrim: jest.fn(),
    expire: jest.fn(),
    lrange: jest.fn(),
    lset: jest.fn(),
    pipeline: jest.fn(),
  },
}))

import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import {
  createNotification,
  getNotifications,
  getPushDeviceStatus,
  markAllRead,
  markRead,
  registerPushDevice,
  unreadCount,
  unregisterPushDevice,
} from './notifications.service'

const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockLpush = redis.lpush as jest.Mock
const mockLtrim = redis.ltrim as jest.Mock
const mockExpire = redis.expire as jest.Mock
const mockLrange = redis.lrange as jest.Mock
const mockLset = redis.lset as jest.Mock
const mockPipeline = redis.pipeline as jest.Mock

const CITIZEN_ID = '00000000-0000-4000-8000-000000000001'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  jest.resetAllMocks()
  mockLpush.mockResolvedValue(1)
  mockLtrim.mockResolvedValue('OK')
  mockExpire.mockResolvedValue(1)
  mockQueryRaw.mockResolvedValue([])
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }))
})

describe('registerPushDevice', () => {
  it('dedupes by push token via a single upsert, reassigning it to the current citizen', async () => {
    mockExecuteRaw.mockResolvedValueOnce(1)

    await registerPushDevice(CITIZEN_ID, 'ExponentPushToken[abc]', 'ios', '1.4.0')

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    const sql = mockExecuteRaw.mock.calls[0][0]
    expect(sql.values).toEqual(
      expect.arrayContaining([CITIZEN_ID, 'ExponentPushToken[abc]', 'ios', '1.4.0']),
    )
  })
})

describe('unregisterPushDevice', () => {
  it('returns true when a matching enabled device was disabled', async () => {
    mockExecuteRaw.mockResolvedValueOnce(1)
    await expect(unregisterPushDevice(CITIZEN_ID, 'ExponentPushToken[abc]')).resolves.toBe(true)
  })

  it('returns false when no enabled device matched the token', async () => {
    mockExecuteRaw.mockResolvedValueOnce(0)
    await expect(unregisterPushDevice(CITIZEN_ID, 'ExponentPushToken[gone]')).resolves.toBe(false)
  })
})

describe('getPushDeviceStatus', () => {
  it('aggregates enabled device counts across platforms', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { platform: 'ios', total: BigInt(2) },
      { platform: 'android', total: BigInt(1) },
    ])

    await expect(getPushDeviceStatus(CITIZEN_ID)).resolves.toEqual({
      enabled_devices: 3,
      platforms: ['ios', 'android'],
    })
  })
})

describe('createNotification', () => {
  it('stores the notification, trims the list and refreshes its TTL', async () => {
    const notif = await createNotification(CITIZEN_ID, 'system', 'Título', 'Cuerpo')

    expect(notif.citizenId).toBe(CITIZEN_ID)
    expect(notif.read).toBe(false)
    expect(mockLpush).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`, expect.any(String))
    expect(mockLtrim).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`, 0, 49)
    expect(mockExpire).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`, 604_800)
  })

  it('never throws when Expo push delivery fails, since push is a side effect, not part of the civic transaction', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { expo_push_token: 'ExponentPushToken[abc]', platform: 'ios', app_version: '1.0', enabled: true, last_seen_at: new Date() },
    ])
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    await expect(createNotification(CITIZEN_ID, 'system', 'Título', 'Cuerpo')).resolves.toMatchObject({
      citizenId: CITIZEN_ID,
    })
  })

  it('disables the push token when Expo reports it is no longer registered', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { expo_push_token: 'ExponentPushToken[dead]', platform: 'ios', app_version: '1.0', enabled: true, last_seen_at: new Date() },
    ])
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
    )
    mockExecuteRaw.mockResolvedValueOnce(1)

    await createNotification(CITIZEN_ID, 'system', 'Título', 'Cuerpo')

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    const sql = mockExecuteRaw.mock.calls[0][0]
    expect(String(sql.strings.join(''))).toContain('enabled = FALSE')
    expect(sql.values).toEqual(expect.arrayContaining(['DeviceNotRegistered', 'ExponentPushToken[dead]']))
  })

  it('records the error without disabling the device for any other ticket error', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { expo_push_token: 'ExponentPushToken[flaky]', platform: 'android', app_version: '1.0', enabled: true, last_seen_at: new Date() },
    ])
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ data: [{ status: 'error', details: { error: 'MessageTooBig' } }] }),
    )
    mockExecuteRaw.mockResolvedValueOnce(1)

    await createNotification(CITIZEN_ID, 'system', 'Título', 'Cuerpo')

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    const sql = mockExecuteRaw.mock.calls[0][0]
    expect(String(sql.strings.join(''))).not.toContain('enabled = FALSE')
    expect(sql.values).toEqual(expect.arrayContaining(['MessageTooBig', 'ExponentPushToken[flaky]']))
  })

  it('does not call Expo at all when the citizen has no enabled devices', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await createNotification(CITIZEN_ID, 'system', 'Título', 'Cuerpo')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('getNotifications / unreadCount', () => {
  it('parses stored notifications and counts only unread ones', async () => {
    mockLrange.mockResolvedValueOnce([
      JSON.stringify({ id: 'n1', citizenId: CITIZEN_ID, type: 'system', title: 'a', body: 'a', read: false, createdAt: 1 }),
      JSON.stringify({ id: 'n2', citizenId: CITIZEN_ID, type: 'system', title: 'b', body: 'b', read: true, createdAt: 2 }),
    ])

    await expect(getNotifications(CITIZEN_ID)).resolves.toHaveLength(2)

    mockLrange.mockResolvedValueOnce([
      JSON.stringify({ id: 'n1', citizenId: CITIZEN_ID, type: 'system', title: 'a', body: 'a', read: false, createdAt: 1 }),
      JSON.stringify({ id: 'n2', citizenId: CITIZEN_ID, type: 'system', title: 'b', body: 'b', read: true, createdAt: 2 }),
    ])
    await expect(unreadCount(CITIZEN_ID)).resolves.toBe(1)
  })
})

describe('markRead', () => {
  it('flips read to true for the matching notification only', async () => {
    mockLrange.mockResolvedValueOnce([
      JSON.stringify({ id: 'n1', citizenId: CITIZEN_ID, type: 'system', title: 'a', body: 'a', read: false, createdAt: 1 }),
      JSON.stringify({ id: 'n2', citizenId: CITIZEN_ID, type: 'system', title: 'b', body: 'b', read: false, createdAt: 2 }),
    ])

    await expect(markRead(CITIZEN_ID, 'n2')).resolves.toBe(true)
    expect(mockLset).toHaveBeenCalledWith(
      `vertice:notif:${CITIZEN_ID}`,
      1,
      expect.stringContaining('"read":true'),
    )
  })

  it('returns false when the notification id does not exist', async () => {
    mockLrange.mockResolvedValueOnce([])
    await expect(markRead(CITIZEN_ID, 'missing')).resolves.toBe(false)
    expect(mockLset).not.toHaveBeenCalled()
  })
})

describe('markAllRead', () => {
  it('rewrites the whole list as read inside one pipeline and refreshes the TTL', async () => {
    mockLrange.mockResolvedValueOnce([
      JSON.stringify({ id: 'n1', citizenId: CITIZEN_ID, type: 'system', title: 'a', body: 'a', read: false, createdAt: 1 }),
    ])
    const pipeline = { del: jest.fn(), rpush: jest.fn(), expire: jest.fn(), exec: jest.fn().mockResolvedValue([]) }
    mockPipeline.mockReturnValueOnce(pipeline)

    await markAllRead(CITIZEN_ID)

    expect(pipeline.del).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`)
    expect(pipeline.rpush).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`, expect.stringContaining('"read":true'))
    expect(pipeline.expire).toHaveBeenCalledWith(`vertice:notif:${CITIZEN_ID}`, 604_800)
    expect(pipeline.exec).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the citizen has no notifications', async () => {
    mockLrange.mockResolvedValueOnce([])
    await markAllRead(CITIZEN_ID)
    expect(mockPipeline).not.toHaveBeenCalled()
  })
})

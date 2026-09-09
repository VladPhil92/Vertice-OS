import { Prisma } from '@prisma/client'
import { redis } from '../../lib/redis'
import { TTL } from '../../lib/cache'
import { dispatchPushNotification } from './push-devices.service'
import { prisma } from '../../lib/prisma'
import { config } from '../../config'

export interface Notification {
  id: string
  citizenId: string
  type: 'report_status' | 'proposal_stage' | 'vote_result' | 'reputation' | 'system'
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: number
}

export interface MobilePushDevice {
  expo_push_token: string
  platform: 'ios' | 'android'
  app_version: string | null
  enabled: boolean
  last_seen_at: Date
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

const NS = 'vertice:notif'
const MAX_PER_CITIZEN = 50
const MAX_PUSH_DEVICES_PER_CITIZEN = 8
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

function key(citizenId: string): string {
  return `${NS}:${citizenId}`
}

export async function registerPushDevice(
  citizenId: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
  appVersion: string | null,
): Promise<void> {
  // The push token is globally unique. Reassigning it on login prevents a
  // shared physical device from continuing to receive the previous citizen's
  // notifications after a different account opts in.
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO mobile_push_devices (
      citizen_id,
      expo_push_token,
      platform,
      app_version,
      enabled,
      last_seen_at,
      last_error_code,
      last_error_at,
      updated_at
    ) VALUES (
      ${citizenId}::uuid,
      ${expoPushToken},
      ${platform},
      ${appVersion},
      TRUE,
      NOW(),
      NULL,
      NULL,
      NOW()
    )
    ON CONFLICT (expo_push_token) DO UPDATE SET
      citizen_id = EXCLUDED.citizen_id,
      platform = EXCLUDED.platform,
      app_version = EXCLUDED.app_version,
      enabled = TRUE,
      last_seen_at = NOW(),
      last_error_code = NULL,
      last_error_at = NULL,
      updated_at = NOW()
  `)
}

export async function unregisterPushDevice(citizenId: string, expoPushToken: string): Promise<boolean> {
  const changed = await prisma.$executeRaw(Prisma.sql`
    UPDATE mobile_push_devices
    SET enabled = FALSE, updated_at = NOW()
    WHERE citizen_id = ${citizenId}::uuid
      AND expo_push_token = ${expoPushToken}
      AND enabled = TRUE
  `)
  return changed > 0
}

export async function getPushDeviceStatus(citizenId: string): Promise<{
  enabled_devices: number
  platforms: Array<'ios' | 'android'>
}> {
  const rows = await prisma.$queryRaw<Array<{ platform: 'ios' | 'android'; total: bigint }>>(Prisma.sql`
    SELECT platform, COUNT(*)::bigint AS total
    FROM mobile_push_devices
    WHERE citizen_id = ${citizenId}::uuid
      AND enabled = TRUE
    GROUP BY platform
  `)

  return {
    enabled_devices: rows.reduce((sum, row) => sum + Number(row.total), 0),
    platforms: rows.map((row) => row.platform),
  }
}

async function disablePushToken(expoPushToken: string, errorCode: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE mobile_push_devices
    SET
      enabled = FALSE,
      last_error_code = ${errorCode},
      last_error_at = NOW(),
      updated_at = NOW()
    WHERE expo_push_token = ${expoPushToken}
  `)
}

async function recordPushTokenError(expoPushToken: string, errorCode: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE mobile_push_devices
    SET
      last_error_code = ${errorCode},
      last_error_at = NOW(),
      updated_at = NOW()
    WHERE expo_push_token = ${expoPushToken}
  `)
}

async function deliverExpoPush(notification: Notification): Promise<void> {
  const devices = await prisma.$queryRaw<MobilePushDevice[]>(Prisma.sql`
    SELECT expo_push_token, platform, app_version, enabled, last_seen_at
    FROM mobile_push_devices
    WHERE citizen_id = ${notification.citizenId}::uuid
      AND enabled = TRUE
    ORDER BY last_seen_at DESC
    LIMIT ${MAX_PUSH_DEVICES_PER_CITIZEN}
  `)

  if (devices.length === 0) return

  const messages = devices.map((device) => ({
    to: device.expo_push_token,
    title: notification.title,
    body: notification.body,
    sound: 'default' as const,
    channelId: 'civic-updates',
    data: {
      notification_id: notification.id,
      type: notification.type,
      href: notification.href ?? null,
    },
  }))

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  }
  if (config.EXPO_PUSH_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${config.EXPO_PUSH_ACCESS_TOKEN}`
  }

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(2500),
  })

  if (!response.ok) {
    throw new Error(`Expo push service returned HTTP ${response.status}`)
  }

  const payload = await response.json() as { data?: ExpoPushTicket | ExpoPushTicket[] }
  const tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : []

  await Promise.all(tickets.map(async (ticket, index) => {
    if (ticket.status !== 'error') return
    const token = devices[index]?.expo_push_token
    if (!token) return

    const errorCode = (ticket.details?.error || 'EXPO_PUSH_TICKET_ERROR').slice(0, 80)
    if (errorCode === 'DeviceNotRegistered') {
      await disablePushToken(token, errorCode)
      return
    }
    await recordPushTokenError(token, errorCode)
  }))
}

export async function createNotification(
  citizenId: string,
  type: Notification['type'],
  title: string,
  body: string,
  href?: string,
): Promise<Notification> {
  const notif: Notification = {
    id: crypto.randomUUID(),
    citizenId,
    type,
    title,
    body,
    href,
    read: false,
    createdAt: Date.now(),
  }

  const k = key(citizenId)
  await redis.lpush(k, JSON.stringify(notif))
  await redis.ltrim(k, 0, MAX_PER_CITIZEN - 1)
  await redis.expire(k, TTL.NOTIFICATION)

  // Push is a non-authoritative delivery channel. Never make a civic mutation
  // fail because Expo/APNs/FCM is unavailable; the Redis ledger above remains
  // the canonical notification record and can be read from any client.
  void dispatchPushNotification(citizenId, {
    title,
    body,
    href,
  }).catch(() => undefined)
  // Push is an engagement side effect, never part of the civic transaction.
  // A provider outage, missing migration, invalid credential or timeout must not
  // roll back the authoritative action that generated the notification.
  try {
    await deliverExpoPush(notif)
  } catch {
    // Delivery observability is intentionally coarse here. Device-level ticket
    // errors are stored when Expo returns them; transport failures remain
    // best-effort and can be surfaced by the operations phase.
  }

  return notif
}

export async function getNotifications(citizenId: string): Promise<Notification[]> {
  const raw = await redis.lrange(key(citizenId), 0, MAX_PER_CITIZEN - 1)
  return raw.map(r => JSON.parse(r) as Notification)
}

export async function markRead(citizenId: string, notifId: string): Promise<boolean> {
  const k = key(citizenId)
  const raw = await redis.lrange(k, 0, MAX_PER_CITIZEN - 1)

  const idx = raw.findIndex(r => {
    try { return (JSON.parse(r) as Notification).id === notifId } catch { return false }
  })
  if (idx === -1) return false

  const notif: Notification = JSON.parse(raw[idx])
  notif.read = true
  await redis.lset(k, idx, JSON.stringify(notif))
  return true
}

export async function markAllRead(citizenId: string): Promise<void> {
  const k = key(citizenId)
  const raw = await redis.lrange(k, 0, MAX_PER_CITIZEN - 1)
  const updated = raw.map(r => {
    try {
      const n = JSON.parse(r) as Notification
      return JSON.stringify({ ...n, read: true })
    } catch { return r }
  })
  if (updated.length === 0) return
  const pipeline = redis.pipeline()
  pipeline.del(k)
  updated.forEach(u => pipeline.rpush(k, u))
  pipeline.expire(k, TTL.NOTIFICATION)
  await pipeline.exec()
}

export async function unreadCount(citizenId: string): Promise<number> {
  const notifs = await getNotifications(citizenId)
  return notifs.filter(n => !n.read).length
}

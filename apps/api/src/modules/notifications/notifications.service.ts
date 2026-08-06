import { redis } from '../../lib/redis'
import { TTL } from '../../lib/cache'

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

const NS = 'vertice:notif'
const MAX_PER_CITIZEN = 50

function key(citizenId: string): string {
  return `${NS}:${citizenId}`
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

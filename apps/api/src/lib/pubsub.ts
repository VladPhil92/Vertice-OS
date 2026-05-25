import { redis } from './redis'

export type EventChannel = 'territorial' | 'governance' | 'system'

export interface RealtimeEvent {
  channel: EventChannel
  type: string
  payload: Record<string, unknown>
  ts: number
}

export async function publish(channel: EventChannel, type: string, payload: Record<string, unknown>): Promise<void> {
  const event: RealtimeEvent = { channel, type, payload, ts: Date.now() }
  await redis.publish(`vertice:${channel}`, JSON.stringify(event))
}

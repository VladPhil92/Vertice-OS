import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export type PushPlatform = 'android' | 'ios'

export interface PushDeviceRegistration {
  installation_id: string
  expo_push_token: string
  platform: PushPlatform
}

interface PushDeviceRow {
  id: string
  expo_push_token: string
  platform: PushPlatform
}

interface ExpoPushTicket {
  status?: 'ok' | 'error'
  details?: { error?: string }
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

export async function registerPushDevice(
  citizenId: string,
  input: PushDeviceRegistration,
): Promise<{ installation_id: string; platform: PushPlatform; status: 'active' }> {
  await prisma.$transaction(async (tx) => {
    // A provider token identifies an app installation, not a civic identity.
    // If the OS/provider rotates or reassigns it, remove stale ownership before
    // binding the current authenticated citizen + installation pair.
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM mobile_push_devices
      WHERE expo_push_token = ${input.expo_push_token}
        AND installation_id <> ${input.installation_id}
    `)

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO mobile_push_devices (
        citizen_id,
        installation_id,
        expo_push_token,
        platform,
        status,
        last_registered_at,
        revoked_at
      ) VALUES (
        ${citizenId}::uuid,
        ${input.installation_id},
        ${input.expo_push_token},
        ${input.platform},
        'active',
        NOW(),
        NULL
      )
      ON CONFLICT (installation_id) DO UPDATE SET
        citizen_id = EXCLUDED.citizen_id,
        expo_push_token = EXCLUDED.expo_push_token,
        platform = EXCLUDED.platform,
        status = 'active',
        last_registered_at = NOW(),
        revoked_at = NULL
    `)
  })

  return {
    installation_id: input.installation_id,
    platform: input.platform,
    status: 'active',
  }
}

export async function revokePushDevice(citizenId: string, installationId: string): Promise<boolean> {
  const updated = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    UPDATE mobile_push_devices
    SET status = 'revoked', revoked_at = NOW()
    WHERE citizen_id = ${citizenId}::uuid
      AND installation_id = ${installationId}
      AND status = 'active'
    RETURNING id::text
  `)
  return updated.length > 0
}

async function activePushDevices(citizenId: string): Promise<PushDeviceRow[]> {
  return prisma.$queryRaw<PushDeviceRow[]>(Prisma.sql`
    SELECT id::text, expo_push_token, platform
    FROM mobile_push_devices
    WHERE citizen_id = ${citizenId}::uuid
      AND status = 'active'
    ORDER BY last_registered_at DESC
    LIMIT 8
  `)
}

async function revokeProviderRejectedToken(token: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE mobile_push_devices
    SET status = 'revoked', revoked_at = NOW()
    WHERE expo_push_token = ${token}
      AND status = 'active'
  `)
}

/**
 * Remote push is a delivery channel only. The canonical notification remains
 * in the existing Redis notification ledger, so provider outages must never
 * roll back or redefine civic state.
 */
export async function dispatchPushNotification(
  citizenId: string,
  notification: { title: string; body: string; href?: string },
): Promise<void> {
  const devices = await activePushDevices(citizenId)
  if (devices.length === 0) return

  const messages = devices.map((device) => ({
    to: device.expo_push_token,
    title: notification.title,
    body: notification.body,
    data: notification.href ? { href: notification.href } : {},
    channelId: device.platform === 'android' ? 'civic-updates' : undefined,
    priority: 'default' as const,
  }))

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  }
  // Optional feature-scoped secret for projects that enable Expo Push Access Tokens.
  // Its absence must never prevent the API from booting or in-app notifications from working.
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN?.trim()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(EXPO_PUSH_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(3500),
  })
  if (!response.ok) {
    throw new Error(`Expo push provider returned HTTP ${response.status}`)
  }

  const payload = await response.json().catch(() => null) as { data?: ExpoPushTicket[] } | null
  const tickets = payload?.data
  if (!Array.isArray(tickets)) return

  await Promise.all(tickets.map(async (ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      const device = devices[index]
      if (device) await revokeProviderRejectedToken(device.expo_push_token)
    }
  }))
}

import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'

const app = buildApp()

function uniqueCitizen(seed: number) {
  const suffix = `${Date.now()}${seed}`.slice(-9).padStart(9, '0')
  return {
    email: `push-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: suffix,
    neighborhood: 'Manga',
    locality_id: 1,
  }
}

async function ensurePushDeviceFixtureTable(): Promise<void> {
  // The production source of truth is the SQL migration. Standard CI still
  // boots from the historical init.sql baseline, so this test creates only the
  // exact table contract it exercises. The Phase 2C structural gate separately
  // asserts that the forward migration exists with ownership cleanup/indexing.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS mobile_push_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
      expo_push_token VARCHAR(255) NOT NULL UNIQUE,
      platform VARCHAR(16) NOT NULL CHECK (platform IN ('ios', 'android')),
      app_version VARCHAR(64),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error_code VARCHAR(80),
      last_error_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function registerAndLogin(seed: number) {
  const input = uniqueCitizen(seed)
  const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
  expect(registered.statusCode).toBe(201)
  const citizenId = (registered.json() as { citizen_id: string }).citizen_id

  const login = await app.inject({
    method: 'POST',
    url: '/auth/token',
    payload: { email: input.email, password: input.password },
  })
  expect(login.statusCode).toBe(200)
  const accessToken = (login.json() as { access_token: string }).access_token
  return { citizenId, authorization: `Bearer ${accessToken}` }
}

describe('Mobile push device lifecycle', () => {
  beforeAll(async () => {
    await ensurePushDeviceFixtureTable()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await Promise.allSettled([
      prisma.$disconnect(),
      closeNeo4j(),
      redis.quit(),
    ])
  })

  test('MP-01 rejects malformed Expo routing credentials', async () => {
    const citizen = await registerAndLogin(91)
    const response = await app.inject({
      method: 'POST',
      url: '/notifications/devices',
      headers: { authorization: citizen.authorization },
      payload: {
        expo_push_token: 'not-an-expo-token',
        platform: 'android',
        app_version: '0.1.0',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  test('MP-02 one physical Expo token belongs to only the latest opted-in citizen', async () => {
    const first = await registerAndLogin(92)
    const second = await registerAndLogin(93)
    const expoPushToken = `ExpoPushToken[golden-${randomUUID()}]`

    const firstRegistration = await app.inject({
      method: 'POST',
      url: '/notifications/devices',
      headers: { authorization: first.authorization },
      payload: { expo_push_token: expoPushToken, platform: 'android', app_version: '0.1.0' },
    })
    expect(firstRegistration.statusCode).toBe(200)

    const firstStatusBefore = await app.inject({
      method: 'GET',
      url: '/notifications/devices/status',
      headers: { authorization: first.authorization },
    })
    expect(firstStatusBefore.json()).toMatchObject({ enabled_devices: 1, platforms: ['android'] })

    const reassignment = await app.inject({
      method: 'POST',
      url: '/notifications/devices',
      headers: { authorization: second.authorization },
      payload: { expo_push_token: expoPushToken, platform: 'ios', app_version: '0.1.0' },
    })
    expect(reassignment.statusCode).toBe(200)

    const firstStatusAfter = await app.inject({
      method: 'GET',
      url: '/notifications/devices/status',
      headers: { authorization: first.authorization },
    })
    expect(firstStatusAfter.json()).toMatchObject({ enabled_devices: 0, platforms: [] })

    const secondStatus = await app.inject({
      method: 'GET',
      url: '/notifications/devices/status',
      headers: { authorization: second.authorization },
    })
    expect(secondStatus.json()).toMatchObject({ enabled_devices: 1, platforms: ['ios'] })

    const staleAccountDelete = await app.inject({
      method: 'DELETE',
      url: '/notifications/devices',
      headers: { authorization: first.authorization },
      payload: { expo_push_token: expoPushToken },
    })
    expect(staleAccountDelete.json()).toMatchObject({ ok: true, disabled: false })

    const stillEnabled = await prisma.$queryRaw<Array<{ citizen_id: string; enabled: boolean }>>(Prisma.sql`
      SELECT citizen_id::text, enabled
      FROM mobile_push_devices
      WHERE expo_push_token = ${expoPushToken}
      LIMIT 1
    `)
    expect(stillEnabled[0]).toMatchObject({ citizen_id: second.citizenId, enabled: true })

    const ownerDelete = await app.inject({
      method: 'DELETE',
      url: '/notifications/devices',
      headers: { authorization: second.authorization },
      payload: { expo_push_token: expoPushToken },
    })
    expect(ownerDelete.json()).toMatchObject({ ok: true, disabled: true })

    const disabled = await prisma.$queryRaw<Array<{ citizen_id: string; enabled: boolean }>>(Prisma.sql`
      SELECT citizen_id::text, enabled
      FROM mobile_push_devices
      WHERE expo_push_token = ${expoPushToken}
      LIMIT 1
    `)
    expect(disabled[0]).toMatchObject({ citizen_id: second.citizenId, enabled: false })
  })
})

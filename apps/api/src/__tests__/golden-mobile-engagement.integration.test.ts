import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'

const describeGolden = process.env.GOLDEN_API_JOURNEYS === '1' ? describe : describe.skip
const app = buildApp()

function uniqueCitizen() {
  const suffix = String(Date.now()).slice(-9).padStart(9, '0')
  return {
    email: `golden-mobile-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: suffix,
    neighborhood: 'Manga',
    locality_id: 1,
  }
}

describeGolden('Golden mobile engagement journey', () => {
  beforeAll(async () => {
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

  test('GJ-08 authenticated installation → token rotation → idempotent revocation', async () => {
    const input = uniqueCitizen()
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
    const authorization = `Bearer ${accessToken}`

    const installationId = `golden_${randomUUID().replace(/-/g, '')}`
    const firstToken = `ExponentPushToken[golden_${randomUUID().replace(/-/g, '')}]`
    const rotatedToken = `ExpoPushToken[golden_${randomUUID().replace(/-/g, '')}]`

    const firstRegistration = await app.inject({
      method: 'POST',
      url: '/notifications/push-devices',
      headers: { authorization },
      payload: {
        installation_id: installationId,
        expo_push_token: firstToken,
        platform: 'android',
      },
    })
    expect(firstRegistration.statusCode).toBe(200)
    expect(firstRegistration.json()).toMatchObject({ installation_id: installationId, platform: 'android', status: 'active' })

    const rotatedRegistration = await app.inject({
      method: 'POST',
      url: '/notifications/push-devices',
      headers: { authorization },
      payload: {
        installation_id: installationId,
        expo_push_token: rotatedToken,
        platform: 'android',
      },
    })
    expect(rotatedRegistration.statusCode).toBe(200)

    const rows = await prisma.$queryRaw<Array<{ expo_push_token: string; status: string }>>(Prisma.sql`
      SELECT expo_push_token, status
      FROM mobile_push_devices
      WHERE citizen_id = ${citizenId}::uuid
        AND installation_id = ${installationId}
    `)
    expect(rows).toEqual([{ expo_push_token: rotatedToken, status: 'active' }])

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/notifications/push-devices/${installationId}`,
      headers: { authorization },
    })
    expect(revoke.statusCode).toBe(200)
    expect(revoke.json()).toEqual({ ok: true })

    const revoked = await prisma.$queryRaw<Array<{ status: string }>>(Prisma.sql`
      SELECT status
      FROM mobile_push_devices
      WHERE citizen_id = ${citizenId}::uuid
        AND installation_id = ${installationId}
    `)
    expect(revoked).toEqual([{ status: 'revoked' }])

    const repeatedRevoke = await app.inject({
      method: 'DELETE',
      url: `/notifications/push-devices/${installationId}`,
      headers: { authorization },
    })
    expect(repeatedRevoke.statusCode).toBe(200)
    expect(repeatedRevoke.json()).toEqual({ ok: true })
  })
})

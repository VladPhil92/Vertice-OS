import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'

const describeGolden = process.env.GOLDEN_API_JOURNEYS === '1' ? describe : describe.skip
const app = buildApp()

function uniqueCitizen() {
  return {
    email: `golden-territorial-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: `${Date.now()}`.slice(-9),
    neighborhood: 'Manga',
    locality_id: 1,
  }
}

describeGolden('GJ-03 territorial golden journey', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('idempotent report → PostGIS point → nearby discovery', async () => {
    const input = uniqueCitizen()
    const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
    expect(registered.statusCode).toBe(201)
    const citizenId = (registered.json() as { citizen_id: string }).citizen_id

    await prisma.citizen.update({ where: { id: citizenId }, data: { verificationLevel: 1 } })

    const login = await app.inject({ method: 'POST', url: '/auth/token', payload: { email: input.email, password: input.password } })
    expect(login.statusCode).toBe(200)
    const accessToken = (login.json() as { access_token: string }).access_token
    const authorization = `Bearer ${accessToken}`

    const idempotencyKey = `golden-report-${randomUUID()}`
    const payload = {
      category: 'infraestructura',
      title: 'Andén deteriorado junto al parque de Manga',
      description: 'El andén presenta roturas y desniveles que dificultan el paso seguro de peatones y personas con movilidad reducida.',
      lat: 10.40615,
      lng: -75.51221,
      neighborhood: 'Manga',
      locality_id: 1,
      address_reference: 'Parque principal de Manga',
    }

    const first = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization, 'idempotency-key': idempotencyKey },
      payload,
    })
    expect(first.statusCode).toBe(201)
    expect(first.headers['idempotency-replayed']).toBe('false')
    const reportId = (first.json() as { id: string }).id

    const replay = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization, 'idempotency-key': idempotencyKey },
      payload,
    })
    expect(replay.statusCode).toBe(201)
    expect(replay.headers['idempotency-replayed']).toBe('true')
    expect((replay.json() as { id: string }).id).toBe(reportId)

    const stored = await prisma.$queryRaw<Array<{ srid: number; lng: number; lat: number; copies: number }>>(Prisma.sql`
      SELECT
        ST_SRID(location::geometry)::int AS srid,
        ST_X(location::geometry)::float8 AS lng,
        ST_Y(location::geometry)::float8 AS lat,
        (SELECT COUNT(*)::int FROM territorial_reports WHERE id = ${reportId}::uuid) AS copies
      FROM territorial_reports
      WHERE id = ${reportId}::uuid
    `)
    expect(stored).toHaveLength(1)
    expect(stored[0].srid).toBe(4326)
    expect(stored[0].lng).toBeCloseTo(payload.lng, 5)
    expect(stored[0].lat).toBeCloseTo(payload.lat, 5)
    expect(stored[0].copies).toBe(1)

    const byId = await app.inject({ method: 'GET', url: `/territorial/reports/${reportId}` })
    expect(byId.statusCode).toBe(200)
    expect(byId.json()).toMatchObject({ id: reportId, neighborhood: 'Manga' })

    const nearby = await app.inject({
      method: 'GET',
      url: '/territorial/reports/nearby?lat=10.40620&lng=-75.51220&radius_km=1&limit=10',
    })
    expect(nearby.statusCode).toBe(200)
    const result = (nearby.json() as { data: Array<{ id: string; distance_meters: number }> }).data
      .find((item) => item.id === reportId)
    expect(result).toBeDefined()
    expect(result?.distance_meters).toBeLessThan(100)
  })
})

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

async function acceptCurrentCommunityPolicy(authorization: string) {
  const state = await app.inject({
    method: 'GET',
    url: '/community/safety/policy',
    headers: { authorization },
  })
  expect(state.statusCode).toBe(200)
  const currentVersion = (state.json() as { current_version: string }).current_version
  const accepted = await app.inject({
    method: 'POST',
    url: '/community/safety/policy/accept',
    headers: { authorization },
    payload: { policy_version: currentVersion },
  })
  expect(accepted.statusCode).toBe(200)
}

describeGolden('GJ-03 territorial golden journey', () => {
  beforeAll(async () => {
    await app.ready()
    // Deterministic synthetic polygon around Cartagena's test point. Production
    // geometry is synchronized from DANE MGN; tests must not depend on that
    // external service being online.
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO territory_boundaries (
        territory_code, geometry, source, source_version, source_checksum, area_sq_km
      ) VALUES (
        'CO-MP-13001',
        ST_Multi(ST_MakeEnvelope(-75.55, 10.35, -75.45, 10.45, 4326))::geometry(MultiPolygon, 4326),
        'golden_fixture',
        'GOLDEN_2026',
        repeat('a', 64),
        100
      )
      ON CONFLICT (territory_code) DO UPDATE SET
        geometry = EXCLUDED.geometry,
        source = EXCLUDED.source,
        source_version = EXCLUDED.source_version,
        source_checksum = EXCLUDED.source_checksum,
        synced_at = NOW()
    `)
  })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('idempotent report → municipal polygon → PostGIS point → nearby discovery', async () => {
    const input = uniqueCitizen()
    const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
    expect(registered.statusCode).toBe(201)
    const citizenId = (registered.json() as { citizen_id: string }).citizen_id

    await prisma.citizen.update({ where: { id: citizenId }, data: { verificationLevel: 1 } })

    const login = await app.inject({ method: 'POST', url: '/auth/token', payload: { email: input.email, password: input.password } })
    expect(login.statusCode).toBe(200)
    const accessToken = (login.json() as { access_token: string }).access_token
    const authorization = `Bearer ${accessToken}`
    await acceptCurrentCommunityPolicy(authorization)

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
      territory_code: 'CO-MP-13001',
      territory_source: 'gps',
    }

    const first = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization, 'idempotency-key': idempotencyKey },
      payload,
    })
    expect(first.statusCode).toBe(201)
    expect(first.headers['idempotency-replayed']).toBe('false')
    expect(first.json()).toMatchObject({
      territory_code: 'CO-MP-13001',
      territory_name: 'Cartagena de Indias',
      department_name: 'Bolívar',
      territory_validation: 'polygon_verified',
      territory_boundary_version: 'GOLDEN_2026',
    })
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

    const stored = await prisma.$queryRaw<Array<{
      srid: number
      lng: number
      lat: number
      copies: number
      territory_validation: string
    }>>(Prisma.sql`
      SELECT
        ST_SRID(location::geometry)::int AS srid,
        ST_X(location::geometry)::float8 AS lng,
        ST_Y(location::geometry)::float8 AS lat,
        (SELECT COUNT(*)::int FROM territorial_reports WHERE id = ${reportId}::uuid) AS copies,
        territory_validation
      FROM territorial_reports
      WHERE id = ${reportId}::uuid
    `)
    expect(stored).toHaveLength(1)
    expect(stored[0].srid).toBe(4326)
    expect(stored[0].lng).toBeCloseTo(payload.lng, 5)
    expect(stored[0].lat).toBeCloseTo(payload.lat, 5)
    expect(stored[0].copies).toBe(1)
    expect(stored[0].territory_validation).toBe('polygon_verified')

    const byId = await app.inject({ method: 'GET', url: `/territorial/reports/${reportId}` })
    expect(byId.statusCode).toBe(200)
    expect(byId.json()).toMatchObject({
      id: reportId,
      neighborhood: 'Manga',
      territory_name: 'Cartagena de Indias',
    })

    const nearby = await app.inject({
      method: 'GET',
      url: '/territorial/reports/nearby?lat=10.40620&lng=-75.51220&radius_km=1&limit=10',
    })
    expect(nearby.statusCode).toBe(200)
    const result = (nearby.json() as { data: Array<{ id: string; distance_meters: number }> }).data
      .find((item) => item.id === reportId)
    expect(result).toBeDefined()
    expect(result?.distance_meters).toBeLessThan(100)

    const mismatch = await app.inject({
      method: 'POST',
      url: '/territorial/reports',
      headers: { authorization, 'idempotency-key': `golden-report-mismatch-${randomUUID()}` },
      payload: {
        ...payload,
        title: 'Reporte deliberadamente fuera del municipio objetivo',
        lat: 6.2442,
        lng: -75.5812,
      },
    })
    expect(mismatch.statusCode).toBe(400)
    expect(mismatch.json()).toMatchObject({ code: 'REPORT_TERRITORY_COORDINATE_MISMATCH' })
  })
})

import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'
import {
  decideTerritoryAssuranceRequest,
  submitTerritoryAssuranceRequest,
} from '../modules/territories/territory-assurance.service'

const describeGolden = process.env.GOLDEN_API_JOURNEYS === '1' ? describe : describe.skip
const app = buildApp()

async function registerCitizen(prefix: string) {
  const input = {
    email: `${prefix}-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9),
  }
  const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
  expect(registered.statusCode).toBe(201)
  const id = (registered.json() as { citizen_id: string }).citizen_id
  const signedIn = await app.inject({ method: 'POST', url: '/auth/token', payload: input })
  expect(signedIn.statusCode).toBe(200)
  return {
    id,
    authorization: `Bearer ${(signedIn.json() as { access_token: string }).access_token}`,
  }
}

describeGolden('GJ-07 territorial residence assurance core', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('proof-backed assurance is auditable, fail-closed and invalidated by a home-territory change', async () => {
    const citizen = await registerCitizen('golden-assurance-citizen')
    const reviewer = await registerCitizen('golden-assurance-reviewer')

    const selected = await app.inject({
      method: 'PUT',
      url: '/territories/me',
      headers: { authorization: citizen.authorization },
      payload: { territory_code: 'CO-MP-13001' },
    })
    expect(selected.statusCode).toBe(200)

    const evidenceReference = `vault:golden/${randomUUID()}`
    const submitted = await submitTerritoryAssuranceRequest({
      citizenId: citizen.id,
      evidenceType: 'secure_document',
      evidenceReference,
    })
    expect(submitted.reused).toBe(false)
    expect(submitted.request.status).toBe('submitted')

    const stored = await prisma.$queryRaw<Array<{
      evidence_reference_digest: string
      raw_reference_present: boolean
    }>>(Prisma.sql`
      SELECT
        evidence_reference_digest,
        evidence_reference_digest = ${evidenceReference} AS raw_reference_present
      FROM territory_assurance_requests
      WHERE id = ${submitted.request.id}::uuid
    `)
    expect(stored[0].evidence_reference_digest).toMatch(/^[0-9a-f]{64}$/)
    expect(stored[0].raw_reference_present).toBe(false)

    await expect(prisma.$executeRaw(Prisma.sql`
      UPDATE citizens
      SET territory_assurance_level = 1,
          territory_assurance_source = 'assurance:secure_document',
          territory_verified_at = NOW()
      WHERE id = ${citizen.id}::uuid
    `)).rejects.toThrow('verified territorial assurance requires territory, timestamp and request provenance')

    const verified = await decideTerritoryAssuranceRequest({
      actorId: reviewer.id,
      requestId: submitted.request.id,
      decision: 'approve',
      reason: 'Golden fixture: proof reference reviewed outside the application database.',
    })
    expect(verified.status).toBe('verified')

    const assured = await prisma.$queryRaw<Array<{
      territory_code: string
      territory_assurance_level: number
      territory_assurance_source: string
      territory_assurance_request_id: string
    }>>(Prisma.sql`
      SELECT
        territory_code,
        territory_assurance_level,
        territory_assurance_source,
        territory_assurance_request_id::text
      FROM citizens
      WHERE id = ${citizen.id}::uuid
    `)
    expect(assured[0]).toMatchObject({
      territory_code: 'CO-MP-13001',
      territory_assurance_level: 1,
      territory_assurance_source: 'assurance:secure_document',
      territory_assurance_request_id: submitted.request.id,
    })

    const moved = await app.inject({
      method: 'PUT',
      url: '/territories/me',
      headers: { authorization: citizen.authorization },
      payload: { territory_code: 'CO-MP-05001' },
    })
    expect(moved.statusCode).toBe(200)

    const afterMove = await prisma.$queryRaw<Array<{
      territory_code: string
      territory_assurance_level: number
      territory_assurance_source: string
      territory_assurance_request_id: string | null
    }>>(Prisma.sql`
      SELECT
        territory_code,
        territory_assurance_level,
        territory_assurance_source,
        territory_assurance_request_id::text
      FROM citizens
      WHERE id = ${citizen.id}::uuid
    `)
    expect(afterMove[0]).toMatchObject({
      territory_code: 'CO-MP-05001',
      territory_assurance_level: 0,
      territory_assurance_source: 'self_asserted',
      territory_assurance_request_id: null,
    })

    const history = await prisma.$queryRaw<Array<{ status: string; event_type: string }>>(Prisma.sql`
      SELECT r.status, e.event_type
      FROM territory_assurance_requests r
      JOIN territory_assurance_events e ON e.request_id = r.id
      WHERE r.id = ${submitted.request.id}::uuid
      ORDER BY e.created_at DESC
      LIMIT 1
    `)
    expect(history[0]).toEqual({ status: 'superseded', event_type: 'superseded' })
  })
})

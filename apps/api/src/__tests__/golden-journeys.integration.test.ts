import { randomUUID } from 'crypto'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'

const describeGolden = process.env.GOLDEN_API_JOURNEYS === '1' ? describe : describe.skip
const app = buildApp()

function uniqueCitizen(seed: number) {
  const suffix = `${Date.now()}${seed}`.slice(-9).padStart(9, '0')
  return {
    email: `golden-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: suffix,
    neighborhood: 'Manga',
    locality_id: 1,
  }
}

function refreshCookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = response.headers['set-cookie']
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) throw new Error('Expected vertice_refresh Set-Cookie header')
  return value.split(';', 1)[0]
}

async function register(input: ReturnType<typeof uniqueCitizen>) {
  const response = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
  expect(response.statusCode).toBe(201)
  return response.json() as { citizen_id: string; did: string }
}

async function login(email: string, password: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/token',
    payload: { email, password },
  })
  expect(response.statusCode).toBe(200)
  const body = response.json() as { access_token: string; citizen_id: string }
  expect(body.access_token).toBeTruthy()
  return { response, body, cookie: refreshCookie(response) }
}

describeGolden('Golden E2E API journeys', () => {
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

  test('GJ-01 auth/session lifecycle: register → login → me → refresh → logout → revoked', async () => {
    const input = uniqueCitizen(1)
    const created = await register(input)
    expect(created.did).toContain(created.citizen_id)

    const signedIn = await login(input.email, input.password)
    expect(signedIn.body.citizen_id).toBe(created.citizen_id)

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${signedIn.body.access_token}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json()).toMatchObject({ id: created.citizen_id, email: input.email })

    const refreshed = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: signedIn.cookie },
    })
    expect(refreshed.statusCode).toBe(200)
    expect((refreshed.json() as { access_token: string }).access_token).toBeTruthy()

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: signedIn.cookie },
    })
    expect(logout.statusCode).toBe(200)

    const replayRefresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: signedIn.cookie },
    })
    expect(replayRefresh.statusCode).toBe(401)
    expect(replayRefresh.json()).toMatchObject({ code: 'INVALID_SESSION' })
  })

  test('GJ-02 civic action loop: verified identity → idempotent action → evidence → persisted ledger', async () => {
    const input = uniqueCitizen(2)
    const created = await register(input)

    // Test-only fixture boundary: the journey under test starts after identity proofing.
    // Production identity assurance is certified separately and must never use this shortcut.
    await prisma.citizen.update({
      where: { id: created.citizen_id },
      data: { verificationLevel: 1 },
    })

    const signedIn = await login(input.email, input.password)
    const authorization = `Bearer ${signedIn.body.access_token}`
    const actionKey = `golden-action-${randomUUID()}`
    const actionPayload = {
      title: 'Recuperar iluminación del parque',
      problem: 'El parque permanece sin iluminación suficiente y la comunidad ha documentado riesgos durante la noche.',
      objective: 'Restablecer iluminación funcional y dejar evidencia verificable del resultado.',
      category: 'Infraestructura',
      neighborhood: 'Manga',
      locality_id: 1,
      beneficiaries_estimate: 120,
    }

    const firstAction = await app.inject({
      method: 'POST',
      url: '/civic-actions',
      headers: { authorization, 'idempotency-key': actionKey },
      payload: actionPayload,
    })
    expect(firstAction.statusCode).toBe(201)
    expect(firstAction.headers['idempotency-replayed']).toBe('false')
    const action = firstAction.json() as { id: string }
    expect(action.id).toBeTruthy()

    const replayAction = await app.inject({
      method: 'POST',
      url: '/civic-actions',
      headers: { authorization, 'idempotency-key': actionKey },
      payload: actionPayload,
    })
    expect(replayAction.statusCode).toBe(201)
    expect(replayAction.headers['idempotency-replayed']).toBe('true')
    expect((replayAction.json() as { id: string }).id).toBe(action.id)

    const evidenceKey = `golden-evidence-${randomUUID()}`
    const evidencePayload = {
      evidence_type: 'photo',
      evidence_url: 'https://example.com/golden-evidence.jpg',
      description: 'Registro fotográfico verificable de la intervención del parque.',
    }

    const firstEvidence = await app.inject({
      method: 'POST',
      url: `/civic-actions/${action.id}/evidence`,
      headers: { authorization, 'idempotency-key': evidenceKey },
      payload: evidencePayload,
    })
    expect(firstEvidence.statusCode).toBe(201)
    expect(firstEvidence.headers['idempotency-replayed']).toBe('false')

    const replayEvidence = await app.inject({
      method: 'POST',
      url: `/civic-actions/${action.id}/evidence`,
      headers: { authorization, 'idempotency-key': evidenceKey },
      payload: evidencePayload,
    })
    expect(replayEvidence.statusCode).toBe(201)
    expect(replayEvidence.headers['idempotency-replayed']).toBe('true')

    const ledger = await app.inject({
      method: 'GET',
      url: `/civic-actions/${action.id}/evidence`,
      headers: { authorization },
    })
    expect(ledger.statusCode).toBe(200)
    const evidence = (ledger.json() as { data: Array<{ description: string }> }).data
    expect(evidence).toHaveLength(1)
    expect(evidence[0]?.description).toContain('Registro fotográfico')

    const mine = await app.inject({
      method: 'GET',
      url: '/civic-actions/mine',
      headers: { authorization },
    })
    expect(mine.statusCode).toBe(200)
    const mineBody = mine.json() as { data: Array<{ id: string }>; count: number }
    expect(mineBody.data.some((item) => item.id === action.id)).toBe(true)
  })
})

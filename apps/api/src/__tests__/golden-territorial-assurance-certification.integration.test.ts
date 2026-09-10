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

const describeCertification = process.env.TERRITORIAL_ASSURANCE_CERTIFICATION === '1' ? describe : describe.skip
const app = buildApp()

async function registerCitizen(seed: number) {
  const input = {
    email: `territory-cert-${seed}-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: `${Date.now()}${seed}${Math.floor(Math.random() * 1000)}`.slice(-9),
    neighborhood: 'Manga',
    locality_id: 1,
  }
  const created = await app.inject({ method: 'POST', url: '/auth/register', payload: input })
  expect(created.statusCode).toBe(201)
  const id = (created.json() as { citizen_id: string }).citizen_id

  await prisma.citizen.update({ where: { id }, data: { verificationLevel: 2 } })
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO civic_identity_proofs
      (citizen_id, provider, provider_reference, status, assurance_level, verified_at, last_event_at)
    VALUES
      (${id}::uuid, 'trusted_kyc', ${`territory-cert-${randomUUID()}`}, 'verified', 2, NOW(), NOW())
  `)

  const signedIn = await app.inject({
    method: 'POST',
    url: '/auth/token',
    payload: { email: input.email, password: input.password },
  })
  expect(signedIn.statusCode).toBe(200)
  const auth = `Bearer ${(signedIn.json() as { access_token: string }).access_token}`

  const policyState = await app.inject({
    method: 'GET',
    url: '/community/safety/policy',
    headers: { authorization: auth },
  })
  expect(policyState.statusCode).toBe(200)
  const currentVersion = (policyState.json() as { current_version: string }).current_version
  const policy = await app.inject({
    method: 'POST',
    url: '/community/safety/policy/accept',
    headers: { authorization: auth },
    payload: { policy_version: currentVersion },
  })
  expect(policy.statusCode).toBe(200)

  return { id, auth }
}

async function selectTerritory(subject: { id: string; auth: string }, territoryCode: string) {
  const response = await app.inject({
    method: 'PUT',
    url: '/territories/me',
    headers: { authorization: subject.auth },
    payload: { territory_code: territoryCode },
  })
  expect(response.statusCode).toBe(200)
}

async function verifyResidence(subjectId: string, reviewerId: string) {
  const submitted = await submitTerritoryAssuranceRequest({
    citizenId: subjectId,
    evidenceType: 'secure_document',
    evidenceReference: `vault:territory-cert/${randomUUID()}`,
  })
  const verified = await decideTerritoryAssuranceRequest({
    actorId: reviewerId,
    requestId: submitted.request.id,
    decision: 'approve',
    reason: 'Phase 7G.4 certification fixture: residence evidence reviewed out of band.',
  })
  expect(verified.status).toBe('verified')
  return verified.id
}

async function eligibility(proposalId: string, auth: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/governance/proposals/${proposalId}/eligibility`,
    headers: { authorization: auth },
  })
  expect(response.statusCode).toBe(200)
  return response.json() as {
    eligible: boolean
    authority: string
    reason_code: string
    frozen_electorate: { available: boolean; member: boolean; provenance_available: boolean }
  }
}

describeCertification('Phase 7G.4 adversarial territorial assurance certification', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('expiry, renewal, scope mismatch and frozen-electorate authority fail closed', async () => {
    const author = await registerCitizen(41)
    const outsider = await registerCitizen(42)
    const reviewer = await registerCitizen(43)

    await selectTerritory(author, 'CO-MP-13001')
    await selectTerritory(outsider, 'CO-MP-05001')
    const firstAuthorAssurance = await verifyResidence(author.id, reviewer.id)
    await verifyResidence(outsider.id, reviewer.id)

    const proposalResponse = await app.inject({
      method: 'POST',
      url: '/governance/proposals',
      headers: { authorization: author.auth, 'idempotency-key': `territory-cert-proposal-${randomUUID()}` },
      payload: {
        title: 'Certificación territorial adversarial para Cartagena',
        description: 'Propuesta de prueba que certifica expiración, renovación, mismatch y autoridad inmutable del padrón territorial.',
        category: 'infraestructura',
        scope: 'city',
      },
    })
    expect(proposalResponse.statusCode).toBe(201)
    const proposalId = (proposalResponse.json() as { id: string }).id

    await expect(eligibility(proposalId, author.auth)).resolves.toMatchObject({
      eligible: true,
      authority: 'current_assurance',
      reason_code: 'ELIGIBLE_CURRENT_ASSURANCE',
    })
    await expect(eligibility(proposalId, outsider.auth)).resolves.toMatchObject({
      eligible: false,
      authority: 'none',
      reason_code: 'TERRITORY_SCOPE_MISMATCH',
    })

    await prisma.$executeRaw(Prisma.sql`
      UPDATE territory_assurance_requests
      SET expires_at = NOW() - INTERVAL '1 second'
      WHERE id = ${firstAuthorAssurance}::uuid
    `)
    await expect(eligibility(proposalId, author.auth)).resolves.toMatchObject({
      eligible: false,
      authority: 'none',
      reason_code: 'TERRITORY_ASSURANCE_EXPIRED',
    })

    const renewedAuthorAssurance = await verifyResidence(author.id, reviewer.id)
    expect(renewedAuthorAssurance).not.toBe(firstAuthorAssurance)
    await expect(eligibility(proposalId, author.auth)).resolves.toMatchObject({
      eligible: true,
      authority: 'current_assurance',
      reason_code: 'ELIGIBLE_CURRENT_ASSURANCE',
    })

    await prisma.$executeRaw(Prisma.sql`
      UPDATE proposals SET endorsement_count = 10 WHERE id = ${proposalId}::uuid
    `)
    for (const [status, body] of [['draft', {}], ['debate', {}], ['voting', { voting_duration_hours: 72 }]] as const) {
      const advanced = await app.inject({
        method: 'PATCH',
        url: `/governance/proposals/${proposalId}/advance`,
        headers: { authorization: author.auth, 'idempotency-key': `territory-cert-advance-${status}-${randomUUID()}` },
        payload: body,
      })
      expect(advanced.statusCode).toBe(200)
      expect((advanced.json() as { status: string }).status).toBe(status)
    }

    const frozen = await prisma.$queryRaw<Array<{
      citizen_id: string
      identity_proof_id: string | null
      territory_assurance_request_id: string | null
      territory_code: string | null
    }>>(Prisma.sql`
      SELECT citizen_id::text, identity_proof_id::text,
             territory_assurance_request_id::text, territory_code
      FROM proposal_voter_roll
      WHERE proposal_id = ${proposalId}::uuid
      ORDER BY citizen_id
    `)
    expect(frozen).toHaveLength(1)
    expect(frozen[0]).toMatchObject({
      citizen_id: author.id,
      territory_assurance_request_id: renewedAuthorAssurance,
      territory_code: 'CO-MP-13001',
    })
    expect(frozen[0].identity_proof_id).not.toBeNull()

    await selectTerritory(author, 'CO-MP-05001')
    await expect(eligibility(proposalId, author.auth)).resolves.toMatchObject({
      eligible: true,
      authority: 'frozen_electorate',
      reason_code: 'ELIGIBLE_FROZEN_ELECTORATE',
      frozen_electorate: { available: true, member: true, provenance_available: true },
    })

    await selectTerritory(outsider, 'CO-MP-13001')
    await verifyResidence(outsider.id, reviewer.id)
    await expect(eligibility(proposalId, outsider.auth)).resolves.toMatchObject({
      eligible: false,
      authority: 'none',
      reason_code: 'NOT_IN_FROZEN_ELECTORATE',
      frozen_electorate: { available: true, member: false },
    })

    const frozenAfterChanges = await prisma.$queryRaw<Array<{
      citizen_id: string
      territory_assurance_request_id: string | null
      territory_code: string | null
    }>>(Prisma.sql`
      SELECT citizen_id::text, territory_assurance_request_id::text, territory_code
      FROM proposal_voter_roll
      WHERE proposal_id = ${proposalId}::uuid
      ORDER BY citizen_id
    `)
    expect(frozenAfterChanges).toEqual(frozen.map(({ citizen_id, territory_assurance_request_id, territory_code }) => ({
      citizen_id,
      territory_assurance_request_id,
      territory_code,
    })))
  })
})

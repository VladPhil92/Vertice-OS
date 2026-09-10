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

async function registerCitizen(seed: string) {
  const input = {
    email: `golden-territory-cert-${seed}-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-9),
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
      (${id}::uuid, 'trusted_kyc', ${`cert-${randomUUID()}`}, 'verified', 2, NOW(), NOW())
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

async function selectTerritory(subject: { auth: string }, territoryCode: string) {
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
    reason: 'Phase 7G.4 Golden certification fixture.',
  })
  return { submitted, verified }
}

async function createCityProposal(author: { auth: string }, title: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/governance/proposals',
    headers: { authorization: author.auth, 'idempotency-key': `proposal-${randomUUID()}` },
    payload: {
      title,
      description: 'Escenario Golden de certificación territorial para validar admisión fail-closed y provenance inmutable en gobernanza subnacional.',
      category: 'infraestructura',
      scope: 'city',
    },
  })
  expect(response.statusCode).toBe(201)
  return response.json() as { id: string }
}

async function preflight(proposalId: string, auth: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/governance/proposals/${proposalId}/eligibility`,
    headers: { authorization: auth },
  })
  expect(response.statusCode).toBe(200)
  return response.json() as { eligible: boolean; reason_code: string; authority: string }
}

describeGolden('GJ-08 Phase 7G.4 territorial assurance certification', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('self review is rejected and identity/territory/reputation cannot replace residence proof', async () => {
    const author = await registerCitizen('non-authority-author')
    const subject = await registerCitizen('non-authority-subject')
    const reviewer = await registerCitizen('non-authority-reviewer')
    await selectTerritory(author, 'CO-MP-13001')
    await selectTerritory(subject, 'CO-MP-13001')
    await selectTerritory(reviewer, 'CO-MP-13001')
    await verifyResidence(author.id, reviewer.id)

    const selfSubmitted = await submitTerritoryAssuranceRequest({
      citizenId: subject.id,
      evidenceType: 'secure_document',
      evidenceReference: `vault:self-review/${randomUUID()}`,
    })
    await expect(decideTerritoryAssuranceRequest({
      actorId: subject.id,
      requestId: selfSubmitted.request.id,
      decision: 'approve',
      reason: 'must fail',
    })).rejects.toMatchObject({ code: 'TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN' })

    await prisma.$executeRaw(Prisma.sql`
      UPDATE citizens SET reputation_score = 100 WHERE id = ${subject.id}::uuid
    `)

    const proposal = await createCityProposal(author, 'Certificación: residencia no sustituible')
    const result = await preflight(proposal.id, subject.auth)
    expect(result).toMatchObject({
      eligible: false,
      reason_code: 'TERRITORY_ASSURANCE_REQUIRED',
    })
  })

  test('expired, revoked and territory-mismatched assurance fail closed before electorate freeze', async () => {
    const author = await registerCitizen('adversarial-author')
    const reviewer = await registerCitizen('adversarial-reviewer')
    const expired = await registerCitizen('expired')
    const mismatched = await registerCitizen('mismatched')
    const revoked = await registerCitizen('revoked')

    await selectTerritory(author, 'CO-MP-13001')
    await selectTerritory(reviewer, 'CO-MP-13001')
    await selectTerritory(expired, 'CO-MP-13001')
    await selectTerritory(mismatched, 'CO-MP-05001')
    await selectTerritory(revoked, 'CO-MP-13001')

    await verifyResidence(author.id, reviewer.id)
    const expiredProof = await verifyResidence(expired.id, reviewer.id)
    await verifyResidence(mismatched.id, reviewer.id)
    const revokedProof = await verifyResidence(revoked.id, reviewer.id)

    await prisma.$executeRaw(Prisma.sql`
      UPDATE territory_assurance_requests
      SET expires_at = NOW() - INTERVAL '1 minute'
      WHERE id = ${expiredProof.verified.id}::uuid
    `)

    await decideTerritoryAssuranceRequest({
      actorId: reviewer.id,
      requestId: revokedProof.verified.id,
      decision: 'revoke',
      reason: 'Phase 7G.4 revocation drill fixture.',
    })

    const proposal = await createCityProposal(author, 'Certificación: expiración, revocación y alcance')

    await expect(preflight(proposal.id, expired.auth)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'TERRITORY_ASSURANCE_EXPIRED',
    })
    await expect(preflight(proposal.id, mismatched.auth)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'TERRITORY_SCOPE_MISMATCH',
    })
    await expect(preflight(proposal.id, revoked.auth)).resolves.toMatchObject({
      eligible: false,
      reason_code: 'TERRITORY_ASSURANCE_REQUIRED',
    })
  })

  test('renewal after freeze never rewrites the frozen territorial provenance', async () => {
    const author = await registerCitizen('frozen-author')
    const reviewer = await registerCitizen('frozen-reviewer')
    await selectTerritory(author, 'CO-MP-13001')
    await selectTerritory(reviewer, 'CO-MP-13001')
    const original = await verifyResidence(author.id, reviewer.id)

    const proposal = await createCityProposal(author, 'Certificación: padrón inmutable ante renovación')
    await prisma.$executeRaw(Prisma.sql`
      UPDATE proposals SET endorsement_count = 10 WHERE id = ${proposal.id}::uuid
    `)

    for (const [status, body] of [['draft', {}], ['debate', {}], ['voting', { voting_duration_hours: 72 }]] as const) {
      const advanced = await app.inject({
        method: 'PATCH',
        url: `/governance/proposals/${proposal.id}/advance`,
        headers: { authorization: author.auth, 'idempotency-key': `cert-advance-${status}-${randomUUID()}` },
        payload: body,
      })
      expect(advanced.statusCode).toBe(200)
    }

    const frozenBefore = await prisma.$queryRaw<Array<{ request_id: string }>>(Prisma.sql`
      SELECT territory_assurance_request_id::text AS request_id
      FROM proposal_voter_roll
      WHERE proposal_id = ${proposal.id}::uuid AND citizen_id = ${author.id}::uuid
    `)
    expect(frozenBefore[0]?.request_id).toBe(original.verified.id)

    await prisma.$executeRaw(Prisma.sql`
      UPDATE territory_assurance_requests
      SET expires_at = NOW() + INTERVAL '20 days'
      WHERE id = ${original.verified.id}::uuid
    `)

    const renewal = await submitTerritoryAssuranceRequest({
      citizenId: author.id,
      evidenceType: 'institutional_attestation',
      evidenceReference: `vault:renewal/${randomUUID()}`,
    })
    expect(renewal.renewal).toBe(true)
    const renewed = await decideTerritoryAssuranceRequest({
      actorId: reviewer.id,
      requestId: renewal.request.id,
      decision: 'approve',
      reason: 'Phase 7G.4 renewal after freeze fixture.',
    })
    expect(renewed.id).not.toBe(original.verified.id)

    const frozenAfter = await prisma.$queryRaw<Array<{ request_id: string }>>(Prisma.sql`
      SELECT territory_assurance_request_id::text AS request_id
      FROM proposal_voter_roll
      WHERE proposal_id = ${proposal.id}::uuid AND citizen_id = ${author.id}::uuid
    `)
    expect(frozenAfter[0]?.request_id).toBe(original.verified.id)

    const result = await preflight(proposal.id, author.auth)
    expect(result).toMatchObject({
      eligible: true,
      authority: 'frozen_electorate',
      reason_code: 'ELIGIBLE_FROZEN_ELECTORATE',
    })
  })
})

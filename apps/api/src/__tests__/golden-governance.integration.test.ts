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

async function citizen(seed: number) {
  const input = {
    email: `golden-gov-${seed}-${randomUUID()}@vertice.test`,
    password: 'GoldenPass123',
    cedula: `${Date.now()}${seed}`.slice(-9),
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
      (${id}::uuid, 'trusted_kyc', ${`golden-${randomUUID()}`}, 'verified', 2, NOW(), NOW())
  `)
  const signedIn = await app.inject({ method: 'POST', url: '/auth/token', payload: { email: input.email, password: input.password } })
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

async function selectCartagena(subject: { id: string; auth: string }) {
  const response = await app.inject({
    method: 'PUT',
    url: '/territories/me',
    headers: { authorization: subject.auth },
    payload: { territory_code: 'CO-MP-13001' },
  })
  expect(response.statusCode).toBe(200)
}

async function verifyResidence(subjectId: string, reviewerId: string) {
  const submitted = await submitTerritoryAssuranceRequest({
    citizenId: subjectId,
    evidenceType: 'secure_document',
    evidenceReference: `vault:golden-governance/${randomUUID()}`,
  })
  expect(submitted.request.status).toBe('submitted')
  return decideTerritoryAssuranceRequest({
    actorId: reviewerId,
    requestId: submitted.request.id,
    decision: 'approve',
    reason: 'Golden fixture: residence evidence reviewed for governance eligibility.',
  })
}

describeGolden('GJ-04 governance golden journey', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('frozen electorate preserves one person, one effective vote and exact assurance provenance', async () => {
    const author = await citizen(4)
    const delegator = await citizen(5)
    const reviewer = await citizen(6)

    await selectCartagena(author)
    await selectCartagena(delegator)
    await verifyResidence(author.id, reviewer.id)
    await verifyResidence(delegator.id, reviewer.id)

    const proposalResponse = await app.inject({
      method: 'POST', url: '/governance/proposals',
      headers: { authorization: author.auth, 'idempotency-key': `proposal-${randomUUID()}` },
      payload: {
        title: 'Corredores peatonales seguros para Cartagena',
        description: 'Crear corredores peatonales seguros con señalización, iluminación y seguimiento público de resultados en puntos priorizados de Cartagena.',
        category: 'infraestructura', scope: 'city',
      },
    })
    expect(proposalResponse.statusCode).toBe(201)
    const proposal = proposalResponse.json() as { id: string }

    const preflight = await app.inject({
      method: 'GET',
      url: `/governance/proposals/${proposal.id}/eligibility`,
      headers: { authorization: author.auth },
    })
    expect(preflight.statusCode).toBe(200)
    expect(preflight.json()).toMatchObject({
      eligible: true,
      authority: 'current_assurance',
      reason_code: 'ELIGIBLE_CURRENT_ASSURANCE',
      territory_assurance: { satisfied: true, territory_code: 'CO-MP-13001' },
    })

    const delegation = await app.inject({
      method: 'POST', url: '/governance/delegations',
      headers: { authorization: delegator.auth, 'idempotency-key': `delegation-${randomUUID()}` },
      payload: { delegate_id: author.id, delegation_type: 'proposal', proposal_id: proposal.id },
    })
    expect(delegation.statusCode).toBe(201)

    await prisma.$executeRaw(Prisma.sql`UPDATE proposals SET endorsement_count = 10 WHERE id = ${proposal.id}::uuid`)

    for (const [status, body] of [['draft', {}], ['debate', {}], ['voting', { voting_duration_hours: 72 }]] as const) {
      const advanced = await app.inject({
        method: 'PATCH', url: `/governance/proposals/${proposal.id}/advance`,
        headers: { authorization: author.auth, 'idempotency-key': `advance-${status}-${randomUUID()}` },
        payload: body,
      })
      expect(advanced.statusCode).toBe(200)
      expect((advanced.json() as { status: string }).status).toBe(status)
    }

    const roll = await prisma.$queryRaw<Array<{
      citizen_id: string
      effective_delegate_id: string | null
      identity_proof_id: string | null
      territory_assurance_request_id: string | null
      territory_verified_at: Date | null
      territory_assurance_expires_at: Date | null
    }>>(Prisma.sql`
      SELECT
        citizen_id::text,
        effective_delegate_id::text,
        identity_proof_id::text,
        territory_assurance_request_id::text,
        territory_verified_at,
        territory_assurance_expires_at
      FROM proposal_voter_roll
      WHERE proposal_id = ${proposal.id}::uuid
    `)
    expect(roll).toHaveLength(2)
    expect(roll.every((row) => row.identity_proof_id !== null)).toBe(true)
    expect(roll.every((row) => row.territory_assurance_request_id !== null)).toBe(true)
    expect(roll.every((row) => row.territory_verified_at instanceof Date)).toBe(true)
    expect(roll.every((row) => row.territory_assurance_expires_at instanceof Date)).toBe(true)
    expect(roll.find((row) => row.citizen_id === delegator.id)?.effective_delegate_id).toBe(author.id)

    const frozenPreflight = await app.inject({
      method: 'GET',
      url: `/governance/proposals/${proposal.id}/eligibility`,
      headers: { authorization: author.auth },
    })
    expect(frozenPreflight.statusCode).toBe(200)
    expect(frozenPreflight.json()).toMatchObject({
      eligible: true,
      authority: 'frozen_electorate',
      reason_code: 'ELIGIBLE_FROZEN_ELECTORATE',
      frozen_electorate: { available: true, member: true, provenance_available: true },
    })

    const representedVote = await app.inject({
      method: 'POST', url: `/governance/proposals/${proposal.id}/vote`,
      headers: { authorization: author.auth, 'idempotency-key': `vote-a-${randomUUID()}` },
      payload: { vote_value: 1 },
    })
    expect(representedVote.statusCode).toBe(201)
    expect(representedVote.json()).toMatchObject({ delegated_count: 1, vote_weight: 2 })

    const override = await app.inject({
      method: 'POST', url: `/governance/proposals/${proposal.id}/vote`,
      headers: { authorization: delegator.auth, 'idempotency-key': `vote-b-${randomUUID()}` },
      payload: { vote_value: -1 },
    })
    expect(override.statusCode).toBe(201)
    expect(override.json()).toMatchObject({ delegated_count: 0, vote_weight: 1 })

    const tally = await app.inject({ method: 'GET', url: `/governance/proposals/${proposal.id}/tally` })
    expect(tally.statusCode).toBe(200)
    expect(tally.json()).toMatchObject({ total_votes: 2, approve_weighted: 1, reject_weighted: 1 })

    const ledger = await prisma.$queryRaw<Array<{ total: number; delegated: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_delegated)::int AS delegated
      FROM votes WHERE proposal_id = ${proposal.id}::uuid
    `)
    expect(ledger[0]).toEqual({ total: 2, delegated: 0 })

    const persisted = await prisma.$queryRaw<Array<{ total_votes: number; eligible_voters: number }>>(Prisma.sql`
      SELECT total_votes::int, eligible_voters::int FROM proposals WHERE id = ${proposal.id}::uuid
    `)
    expect(persisted[0]).toEqual({ total_votes: 2, eligible_voters: 2 })
  })
})

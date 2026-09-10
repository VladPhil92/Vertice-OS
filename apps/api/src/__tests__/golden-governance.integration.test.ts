import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { buildApp } from '../app'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { closeNeo4j } from '../lib/neo4j'

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
  const policy = await app.inject({
    method: 'POST',
    url: '/community/safety/policy/accept',
    headers: { authorization: auth },
    payload: { policy_version: '2026-09-10' },
  })
  expect(policy.statusCode).toBe(200)
  return { id, auth }
}

describeGolden('GJ-04 governance golden journey', () => {
  beforeAll(async () => { await app.ready() })
  afterAll(async () => {
    await app.close()
    await Promise.allSettled([prisma.$disconnect(), closeNeo4j(), redis.quit()])
  })

  test('frozen electorate preserves one person, one effective vote', async () => {
    const author = await citizen(4)
    const delegator = await citizen(5)

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

    const roll = await prisma.$queryRaw<Array<{ citizen_id: string; effective_delegate_id: string | null }>>(Prisma.sql`
      SELECT citizen_id::text, effective_delegate_id::text
      FROM proposal_voter_roll WHERE proposal_id = ${proposal.id}::uuid
    `)
    expect(roll).toHaveLength(2)
    expect(roll.find((row) => row.citizen_id === delegator.id)?.effective_delegate_id).toBe(author.id)

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

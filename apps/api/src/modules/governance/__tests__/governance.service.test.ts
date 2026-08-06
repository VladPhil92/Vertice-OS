const mockQueryRaw = jest.fn()
const mockGetCache = jest.fn()
const mockSetCache = jest.fn()
const mockDelCache = jest.fn()
const mockRedisSadd = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))

jest.mock('../../../lib/redis', () => ({
  redis: { sadd: mockRedisSadd },
}))

import { createHmac } from 'crypto'
import {
  createProposal,
  listProposals,
  getProposalById,
  endorseProposal,
  advanceProposalStage,
  castVote,
  getVoteTally,
  createDelegation,
  revokeDelegation,
  getGovernanceStats,
} from '../governance.service'

// Replica voteNullifier() (privada en governance.service.ts) usando la misma
// VOTE_NULLIFIER_SECRET fijada en __tests__/setup.ts, para poder construir un
// nullifier "ya votado" válido sin exportar la función interna.
function voteNullifierForTest(citizenId: string, proposalId: string): string {
  return createHmac('sha256', process.env.VOTE_NULLIFIER_SECRET as string)
    .update(`${citizenId}:${proposalId}`)
    .digest('hex')
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROPOSAL_ROW = {
  id: 'proposal-uuid',
  author_id: 'author-uuid',
  title: 'Mejorar el parque central del barrio de Manga',
  description: 'El parque necesita iluminación y zonas de recreación adecuadas para todos los ciudadanos del sector.',
  executive_summary: 'Renovación del parque central',
  category: 'infraestructura',
  scope: 'neighborhood',
  locality_id: 1,
  neighborhood: 'Manga',
  status: 'idea',
  endorsement_count: 0n,
  comment_count: 0n,
  view_count: 0n,
  quorum_required: null,
  approval_threshold: null,
  eligible_voters: null,
  total_votes: 0n,
  approve_votes_weighted: '0.0000',
  reject_votes_weighted: '0.0000',
  abstain_votes_weighted: '0.0000',
  assigned_executor: null,
  execution_deadline: null,
  blockchain_tx_hash: null,
  ipfs_proposal_uri: null,
  ipfs_result_uri: null,
  created_at: new Date('2024-06-01T10:00:00Z'),
  draft_started_at: null,
  debate_started_at: null,
  voting_starts_at: null,
  voting_ends_at: null,
  decided_at: null,
}

const DELEGATION_ROW = {
  id: 'delegation-uuid',
  delegator_id: 'delegator-uuid',
  delegate_id: 'delegate-uuid',
  delegation_type: 'general',
  domain: null,
  proposal_id: null,
  is_active: true,
  valid_from: new Date('2024-06-01T10:00:00Z'),
  valid_until: null,
  created_at: new Date('2024-06-01T10:00:00Z'),
  revoked_at: null,
}

beforeEach(() => {
  jest.resetAllMocks()
  mockSetCache.mockResolvedValue(undefined)
  mockDelCache.mockResolvedValue(undefined)
  mockRedisSadd.mockResolvedValue(1)
})

// ── createProposal ─────────────────────────────────────────────────────────────

describe('createProposal', () => {
  it('creates proposal and returns normalized data', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ locality_id: 1, neighborhood: 'Manga' }]) // snapshot del autor
      .mockResolvedValueOnce([PROPOSAL_ROW])

    const proposal = await createProposal('author-uuid', {
      title: 'Mejorar el parque central del barrio',
      description: 'El parque necesita iluminación y zonas de recreación adecuadas para todos los vecinos.',
      category: 'infraestructura',
      scope: 'neighborhood',
    })

    expect(proposal.id).toBe('proposal-uuid')
    expect(proposal.status).toBe('idea')
    expect(proposal.endorsement_count).toBe(0)
    expect(typeof proposal.endorsement_count).toBe('number')
    expect(proposal.total_votes).toBe(0)
    expect(typeof proposal.approve_votes_weighted).toBe('number')
  })

  it('rejects a neighborhood-scope proposal when the author has no neighborhood set', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ locality_id: null, neighborhood: null }])

    await expect(createProposal('author-uuid', {
      title: 'Propuesta sin barrio de autor',
      description: 'El parque necesita iluminación y zonas de recreación adecuadas para todos.',
      category: 'infraestructura',
      scope: 'neighborhood',
    })).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_NEIGHBORHOOD' })
  })

  it('rejects a locality-scope proposal when the author has no locality set', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ locality_id: null, neighborhood: null }])

    await expect(createProposal('author-uuid', {
      title: 'Propuesta sin localidad de autor',
      description: 'La localidad necesita mejoras en infraestructura vial para todos los vecinos.',
      category: 'infraestructura',
      scope: 'locality',
    })).rejects.toMatchObject({ statusCode: 400, code: 'MISSING_LOCALITY' })
  })

  it('allows a city-scope proposal even when the author has no territory set', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ locality_id: null, neighborhood: null }])
      .mockResolvedValueOnce([{ ...PROPOSAL_ROW, scope: 'city', locality_id: null, neighborhood: null }])

    const proposal = await createProposal('author-uuid', {
      title: 'Propuesta de ciudad sin restricción territorial',
      description: 'Esta propuesta aplica a toda la ciudad, no requiere barrio ni localidad del autor.',
      category: 'infraestructura',
      scope: 'city',
    })

    expect(proposal.scope).toBe('city')
  })
})

// ── listProposals ──────────────────────────────────────────────────────────────

describe('listProposals', () => {
  it('returns array of proposal summaries without description', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROPOSAL_ROW, { ...PROPOSAL_ROW, id: 'p2' }])

    const proposals = await listProposals({ limit: 20, offset: 0 })

    expect(proposals).toHaveLength(2)
    expect(proposals[0].id).toBe('proposal-uuid')
    expect((proposals[0] as unknown as Record<string, unknown>).description).toBeUndefined()
  })

  it('returns empty array when no proposals found', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    const proposals = await listProposals({ limit: 20, offset: 0 })
    expect(proposals).toHaveLength(0)
  })

  it('passes filters to query', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await listProposals({ limit: 10, offset: 0, status: 'voting', category: 'movilidad', scope: 'city' })

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})

// ── getProposalById ────────────────────────────────────────────────────────────

describe('getProposalById', () => {
  it('returns cached proposal without hitting DB', async () => {
    const cached = { ...PROPOSAL_ROW, endorsement_count: 5 }
    mockGetCache.mockResolvedValueOnce(cached)

    const proposal = await getProposalById('proposal-uuid')

    expect(proposal).toBe(cached)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('fetches from DB on cache miss and caches result', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce([PROPOSAL_ROW])
    mockQueryRaw.mockResolvedValue(undefined) // view count fire-and-forget

    const proposal = await getProposalById('proposal-uuid')

    expect(proposal.id).toBe('proposal-uuid')
    expect(mockSetCache).toHaveBeenCalledWith(
      'proposal', 'proposal-uuid', expect.objectContaining({ id: 'proposal-uuid' }), 120
    )
  })

  it('throws 404 when proposal does not exist', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getProposalById('nonexistent')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROPOSAL_NOT_FOUND',
    })
  })
})

// ── endorseProposal ────────────────────────────────────────────────────────────

describe('endorseProposal', () => {
  // Postgres (proposal_endorsements, PK compuesta) es ahora la fuente de
  // verdad de "quién avaló", no Redis. La secuencia es: SELECT propuesta →
  // INSERT ... ON CONFLICT DO NOTHING (guarda real de duplicados) → UPDATE
  // contador → posible avance de etapa. Redis sadd es fire-and-forget y no
  // determina el resultado.
  beforeEach(() => {
    mockRedisSadd.mockResolvedValue(1)
  })

  it('endorses proposal and returns updated count', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'proposal-uuid', status: 'idea', endorsement_count: 5n }]) // get proposal
      .mockResolvedValueOnce([{ citizen_id: 'citizen-uuid' }])                                 // insert ok
      .mockResolvedValueOnce([{ endorsement_count: 6n, status: 'idea' }])                       // update count

    const result = await endorseProposal('proposal-uuid', 'citizen-uuid')

    expect(result.endorsement_count).toBe(6)
    expect(result.status).toBe('idea')
    expect(result.advanced).toBe(false)
  })

  it('throws 409 when citizen already endorsed (INSERT ... ON CONFLICT devuelve 0 filas)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'p', status: 'idea', endorsement_count: 3n }]) // get proposal
      .mockResolvedValueOnce([])                                                   // insert: conflicto, sin filas

    await expect(endorseProposal('proposal-uuid', 'citizen-uuid')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_ENDORSED',
    })
  })

  it('prevents double endorsement from concurrent requests (atomic INSERT ... ON CONFLICT guard)', async () => {
    // Dos requests concurrentes: ambas leen la propuesta antes de que
    // cualquiera inserte en proposal_endorsements. Solo la primera INSERT
    // gana la restricción UNIQUE; la restricción, no una lectura previa, es
    // la guarda real.
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'p', status: 'idea', endorsement_count: 3n }]) // get proposal (1ª)
      .mockResolvedValueOnce([{ id: 'p', status: 'idea', endorsement_count: 3n }]) // get proposal (2ª)
      .mockResolvedValueOnce([{ citizen_id: 'citizen-uuid' }])                    // insert (1ª): nueva fila
      .mockResolvedValueOnce([])                                                   // insert (2ª): conflicto
      .mockResolvedValueOnce([{ endorsement_count: 4n, status: 'idea' }])          // update count (1ª)

    const [first, second] = await Promise.allSettled([
      endorseProposal('proposal-uuid', 'citizen-uuid'),
      endorseProposal('proposal-uuid', 'citizen-uuid'),
    ])

    expect(first.status).toBe('fulfilled')
    expect(second.status).toBe('rejected')
    if (second.status === 'rejected') {
      expect(second.reason).toMatchObject({ statusCode: 409, code: 'ALREADY_ENDORSED' })
    }
  })

  it('auto-advances to draft when endorsement_count reaches 10', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'p', status: 'idea', endorsement_count: 9n }]) // get proposal
      .mockResolvedValueOnce([{ citizen_id: 'citizen-uuid' }])                     // insert ok
      .mockResolvedValueOnce([{ endorsement_count: 10n, status: 'idea' }])          // update count
      .mockResolvedValueOnce([{ status: 'draft' }])                                 // advance to draft

    const result = await endorseProposal('proposal-uuid', 'citizen-uuid')

    expect(result.status).toBe('draft')
    expect(result.advanced).toBe(true)
    expect(result.endorsement_count).toBe(10)
  })
})

// ── advanceProposalStage ───────────────────────────────────────────────────────

describe('advanceProposalStage', () => {
  it('advances idea → draft when endorsements are sufficient', async () => {
    const ideaProposal = { ...PROPOSAL_ROW, endorsement_count: 10n }
    mockQueryRaw
      .mockResolvedValueOnce([ideaProposal])
      .mockResolvedValueOnce([{ ...PROPOSAL_ROW, status: 'draft', draft_started_at: new Date(), endorsement_count: 10n }])

    const proposal = await advanceProposalStage('proposal-uuid', 'author-uuid')

    expect(proposal.status).toBe('draft')
  })

  it('throws 400 when idea has insufficient endorsements', async () => {
    const ideaProposal = { ...PROPOSAL_ROW, endorsement_count: 5n }
    mockQueryRaw.mockResolvedValueOnce([ideaProposal])

    await expect(advanceProposalStage('proposal-uuid', 'author-uuid')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INSUFFICIENT_ENDORSEMENTS',
    })
  })

  it('advances draft → debate', async () => {
    const draftProposal = { ...PROPOSAL_ROW, status: 'draft', endorsement_count: 10n }
    mockQueryRaw
      .mockResolvedValueOnce([draftProposal])
      .mockResolvedValueOnce([{ ...PROPOSAL_ROW, status: 'debate', debate_started_at: new Date(), endorsement_count: 10n }])

    const proposal = await advanceProposalStage('proposal-uuid', 'author-uuid')

    expect(proposal.status).toBe('debate')
  })

  it('advances debate → voting with quorum parameters', async () => {
    const debateProposal = { ...PROPOSAL_ROW, status: 'debate', endorsement_count: 10n }
    const votingProposal = {
      ...PROPOSAL_ROW,
      status: 'voting',
      endorsement_count: 10n,
      quorum_required: '0.150',
      approval_threshold: '0.400',
      eligible_voters: 500n,
      voting_starts_at: new Date(),
      voting_ends_at: new Date(Date.now() + 48 * 3600 * 1000),
    }
    mockQueryRaw
      .mockResolvedValueOnce([debateProposal])              // get proposal
      .mockResolvedValueOnce([{ count: 500n }])             // eligible voters count
      .mockResolvedValueOnce([votingProposal])              // update proposal

    const proposal = await advanceProposalStage('proposal-uuid', 'author-uuid')

    expect(proposal.status).toBe('voting')
    expect(proposal.quorum_required).toBe(0.15)
    expect(proposal.approval_threshold).toBe(0.4)
    expect(proposal.eligible_voters).toBe(500)
  })

  it('throws 403 when caller is not the author', async () => {
    mockQueryRaw.mockResolvedValueOnce([PROPOSAL_ROW])

    await expect(advanceProposalStage('proposal-uuid', 'wrong-citizen-uuid')).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_AUTHOR',
    })
  })

  it('finalizes voting into approved when quorum and threshold are met', async () => {
    const closedVoting = {
      ...PROPOSAL_ROW,
      status: 'voting',
      endorsement_count: 10n,
      quorum_required: '0.100',
      approval_threshold: '0.400',
      eligible_voters: 100n,
      total_votes: 20n,
      approve_votes_weighted: '16.0000',
      reject_votes_weighted: '4.0000',
      abstain_votes_weighted: '0.0000',
      voting_ends_at: new Date(Date.now() - 1000), // expired
    }
    mockQueryRaw
      .mockResolvedValueOnce([closedVoting])
      .mockResolvedValueOnce([{ ...closedVoting, status: 'approved', decided_at: new Date() }])

    const proposal = await advanceProposalStage('proposal-uuid', 'wrong-author', {})

    expect(proposal.status).toBe('approved')
  })
})

// ── castVote ───────────────────────────────────────────────────────────────────

describe('castVote', () => {
  const votingProposal = {
    ...PROPOSAL_ROW,
    status: 'voting',
    endorsement_count: 10n,
    voting_ends_at: new Date(Date.now() + 3600 * 1000),
  }

  it('casts vote and returns receipt', async () => {
    const voteRow = { id: 'vote-uuid', vote_weight: '1.0000', vote_value: 1, created_at: new Date() }
    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '0.0000' }])
      .mockResolvedValueOnce([voteRow])
      .mockResolvedValueOnce([])

    const receipt = await castVote('proposal-uuid', 'citizen-uuid', 1)

    expect(receipt.vote_id).toBe('vote-uuid')
    expect(receipt.vote_value).toBe(1)
    expect(typeof receipt.vote_weight).toBe('number')
    expect(receipt.proposal_id).toBe('proposal-uuid')
  })

  it('un ciudadano = un voto: la reputación alta no aumenta el peso del voto', async () => {
    // Regresión: computeVoteWeight escalaba 1.0-1.5 según reputation_score.
    // Con reputación muy alta, el peso debe seguir siendo exactamente 1.0.
    const voteRow = { id: 'vote-uuid', vote_weight: '1.0000', vote_value: 1, created_at: new Date() }
    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '999.0000' }]) // reputación altísima
      .mockResolvedValueOnce([voteRow])
      .mockResolvedValueOnce([]) // sin delegadores

    const receipt = await castVote('proposal-uuid', 'citizen-uuid', 1)

    expect(receipt.vote_weight).toBe(1.0)
  })

  it('agrega el voto de delegados que no han votado directamente, con peso 1.0 cada uno', async () => {
    const voteRow = { id: 'vote-uuid', vote_weight: '1.0000', vote_value: 1, created_at: new Date() }
    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '0.0000' }])
      .mockResolvedValueOnce([voteRow])
      // dos delegadores confían en este ciudadano
      .mockResolvedValueOnce([
        { delegator_id: 'delegator-1', reputation_score: '500.0000' }, // reputación alta: no debe importar
        { delegator_id: 'delegator-2', reputation_score: '0.0000' },
      ])
      // ninguno de los dos ha votado directamente todavía
      .mockResolvedValueOnce([])

    const receipt = await castVote('proposal-uuid', 'citizen-uuid', 1)

    // 1 (propio) + 1 (delegator-1) + 1 (delegator-2) = 3, nunca 1 + 1.5 + 1.5
    expect(receipt.vote_weight).toBe(3.0)
  })

  it('excluye delegados que ya votaron directamente, comparando por el mismo nullifier', async () => {
    const voteRow = { id: 'vote-uuid', vote_weight: '1.0000', vote_value: 1, created_at: new Date() }
    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 0, reputation_score: '0.0000' }])
      .mockResolvedValueOnce([voteRow])
      .mockResolvedValueOnce([
        { delegator_id: 'delegator-1', reputation_score: '0.0000' },
        { delegator_id: 'delegator-2', reputation_score: '0.0000' },
      ])
      // La consulta de nullifiers ya votados devuelve el de delegator-1 —
      // debe calcularse con voteNullifier(), la misma función que el resto
      // del módulo, para que esta comparación sea correcta.
      .mockImplementationOnce(async () => [
        { nullifier_hash: voteNullifierForTest('delegator-1', 'proposal-uuid') },
      ])

    const receipt = await castVote('proposal-uuid', 'citizen-uuid', 1)

    // 1 (propio) + 1 (delegator-2, no votó aún) = 2. delegator-1 se excluye.
    expect(receipt.vote_weight).toBe(2.0)
  })

  it('throws 409 on double vote', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([votingProposal])
      .mockResolvedValueOnce([{ already_voted: 1, reputation_score: '0.0000' }])

    await expect(castVote('proposal-uuid', 'citizen-uuid', 1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_VOTED',
    })
  })

  it('throws 400 when proposal is not in voting status', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...PROPOSAL_ROW, status: 'draft', endorsement_count: 10n }])

    await expect(castVote('proposal-uuid', 'citizen-uuid', 1)).rejects.toMatchObject({
      statusCode: 400,
      code: 'WRONG_STATUS',
    })
  })

  it('throws 400 when voting period has closed', async () => {
    const closedProposal = {
      ...PROPOSAL_ROW,
      status: 'voting',
      endorsement_count: 10n,
      voting_ends_at: new Date(Date.now() - 1000),
    }
    mockQueryRaw.mockResolvedValueOnce([closedProposal])

    await expect(castVote('proposal-uuid', 'citizen-uuid', 1)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VOTING_CLOSED',
    })
  })
})

// ── getVoteTally ───────────────────────────────────────────────────────────────

describe('getVoteTally', () => {
  it('returns tally with quorum_reached computed', async () => {
    const tallyRow = {
      id: 'proposal-uuid',
      status: 'voting',
      total_votes: 20n,
      approve_votes_weighted: '15.0000',
      reject_votes_weighted: '5.0000',
      abstain_votes_weighted: '0.0000',
      quorum_required: '0.150',
      approval_threshold: '0.550',
      eligible_voters: 100n,
      voting_ends_at: new Date(Date.now() + 3600 * 1000),
    }
    mockQueryRaw.mockResolvedValueOnce([tallyRow])

    const tally = await getVoteTally('proposal-uuid')

    expect(tally.total_votes).toBe(20)
    expect(tally.quorum_reached).toBe(true)  // 20/100 = 0.20 >= 0.15
    expect(tally.approval_percentage).toBe(75) // 15/20 = 75%
  })

  it('throws 404 when proposal not found', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getVoteTally('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── createDelegation ───────────────────────────────────────────────────────────

describe('createDelegation', () => {
  it('creates general delegation successfully', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ exists: false }])  // circular check
      .mockResolvedValueOnce([])                   // deactivate existing
      .mockResolvedValueOnce([DELEGATION_ROW])     // insert

    const delegation = await createDelegation('delegator-uuid', {
      delegate_id: 'delegate-uuid',
      delegation_type: 'general',
    })

    expect(delegation.id).toBe('delegation-uuid')
    expect(delegation.is_active).toBe(true)
  })

  it('throws 400 on circular delegation', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ exists: true }])

    await expect(
      createDelegation('delegator-uuid', { delegate_id: 'delegate-uuid', delegation_type: 'general' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'CIRCULAR_DELEGATION' })
  })

  it('throws 400 on self-delegation', async () => {
    await expect(
      createDelegation('same-uuid', { delegate_id: 'same-uuid', delegation_type: 'general' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'SELF_DELEGATION' })
  })
})

// ── revokeDelegation ───────────────────────────────────────────────────────────

describe('revokeDelegation', () => {
  it('revokes delegation successfully', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'delegation-uuid', delegator_id: 'citizen-uuid' }])
      .mockResolvedValueOnce([])

    await expect(revokeDelegation('delegation-uuid', 'citizen-uuid')).resolves.toBeUndefined()
    expect(mockQueryRaw).toHaveBeenCalledTimes(2)
  })

  it('throws 403 when caller is not the delegator', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'delegation-uuid', delegator_id: 'other-uuid' }])

    await expect(revokeDelegation('delegation-uuid', 'citizen-uuid')).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_DELEGATOR',
    })
  })
})

// ── getGovernanceStats ─────────────────────────────────────────────────────────

describe('getGovernanceStats', () => {
  it('returns cached stats without hitting DB', async () => {
    const cached = { total_proposals: 10, by_status: [], by_category: [], active_votes: 2, total_votes_cast: 50 }
    mockGetCache.mockResolvedValueOnce(cached)

    const stats = await getGovernanceStats()

    expect(stats).toBe(cached)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it('aggregates stats and converts bigint counts to numbers', async () => {
    mockGetCache.mockResolvedValueOnce(null)
    mockQueryRaw
      .mockResolvedValueOnce([
        { status: 'idea', count: 5n },
        { status: 'voting', count: 2n },
        { status: 'approved', count: 3n },
      ])
      .mockResolvedValueOnce([
        { category: 'infraestructura', count: 7n },
        { category: 'movilidad', count: 3n },
      ])
      .mockResolvedValueOnce([{ active_votes: 2n, total_votes_cast: 42n }])

    const stats = await getGovernanceStats()

    expect(stats.total_proposals).toBe(10)
    expect(stats.active_votes).toBe(2)
    expect(stats.total_votes_cast).toBe(42)
    expect(stats.by_status).toHaveLength(3)
    expect(stats.by_category[0].count).toBe(7)
    expect(typeof stats.by_category[0].count).toBe('number')
    expect(mockSetCache).toHaveBeenCalledWith('stats', 'global', expect.any(Object), 600)
  })
})

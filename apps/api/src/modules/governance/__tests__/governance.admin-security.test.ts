const mockTxQueryRaw = jest.fn()
const mockTransaction = jest.fn((cb: (tx: { $queryRaw: typeof mockTxQueryRaw }) => unknown) =>
  cb({ $queryRaw: mockTxQueryRaw }),
)
const mockDelCache = jest.fn().mockResolvedValue(undefined)
const mockRecordAudit = jest.fn().mockResolvedValue(undefined)

jest.mock('../../../lib/prisma', () => ({
  prisma: { $transaction: mockTransaction },
}))
jest.mock('../../../lib/cache', () => ({ delCache: mockDelCache }))
jest.mock('../../../lib/audit', () => ({ recordAuditEvent: mockRecordAudit }))

import { adminArchiveProposalSafely } from '../governance.admin-security'

const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440001'
const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440099'

const ARCHIVED_ROW = {
  id: PROPOSAL_ID,
  author_id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Propuesta moderada antes de votación',
  description: 'Descripción extensa de una propuesta que todavía no ha abierto una consulta cívica.',
  executive_summary: null,
  category: 'infraestructura',
  scope: 'city',
  locality_id: null,
  neighborhood: null,
  status: 'archived',
  endorsement_count: 2,
  comment_count: 0,
  view_count: 0,
  quorum_required: null,
  approval_threshold: null,
  eligible_voters: null,
  total_votes: 0,
  approve_votes_weighted: '0.0000',
  reject_votes_weighted: '0.0000',
  abstain_votes_weighted: '0.0000',
  assigned_executor: null,
  execution_deadline: null,
  rejection_reason: null,
  blockchain_tx_hash: null,
  ipfs_proposal_uri: null,
  ipfs_result_uri: null,
  created_at: new Date('2026-09-01T00:00:00Z'),
  draft_started_at: null,
  debate_started_at: null,
  voting_starts_at: null,
  voting_ends_at: null,
  decided_at: null,
}

function sqlText(value: unknown): string {
  const sql = value as { strings?: readonly string[] }
  return sql.strings?.join(' ') ?? String(value)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTxQueryRaw.mockReset()
  mockTransaction.mockImplementation((cb: (tx: { $queryRaw: typeof mockTxQueryRaw }) => unknown) =>
    cb({ $queryRaw: mockTxQueryRaw }),
  )
})

describe('secure governance moderation archive', () => {
  it('archives only a pre-vote proposal and commits the audit evidence in the same transaction', async () => {
    mockTxQueryRaw
      .mockResolvedValueOnce([{ id: PROPOSAL_ID, status: 'draft', voting_starts_at: null }])
      .mockResolvedValueOnce([ARCHIVED_ROW])
      .mockResolvedValueOnce([])

    const result = await adminArchiveProposalSafely(PROPOSAL_ID, ACTOR_ID, 'Contenido duplicado verificado')

    expect(result.status).toBe('archived')
    expect(mockTxQueryRaw).toHaveBeenCalledTimes(3)

    const updateSql = sqlText(mockTxQueryRaw.mock.calls[1]?.[0])
    expect(updateSql).toContain("SET status = 'archived'")
    expect(updateSql).toContain("status IN ('idea', 'draft', 'debate')")
    expect(updateSql).not.toContain('updated_at')
    expect(updateSql).not.toContain('rejection_reason')

    const auditSql = sqlText(mockTxQueryRaw.mock.calls[2]?.[0])
    expect(auditSql).toContain('admin_audit_log')
    expect(auditSql).toContain('admin_archive_proposal')

    expect(mockRecordAudit).not.toHaveBeenCalled()
    expect(mockDelCache).toHaveBeenCalledWith('proposal', PROPOSAL_ID)
    expect(mockDelCache).toHaveBeenCalledWith('stats', 'global')
  })

  it('rejects archival once a civic voting record exists', async () => {
    mockTxQueryRaw.mockResolvedValueOnce([{
      id: PROPOSAL_ID,
      status: 'voting',
      voting_starts_at: new Date('2026-09-02T00:00:00Z'),
    }])

    await expect(
      adminArchiveProposalSafely(PROPOSAL_ID, ACTOR_ID, 'Retirar después de abrir votación'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_DECISION_IMMUTABLE',
    })

    expect(mockTxQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockRecordAudit).toHaveBeenCalledWith(expect.objectContaining({
      result: 'rejected',
      metadata: expect.objectContaining({ civic_decision_immutable: true }),
    }))
  })

  it('records a not-found moderation attempt without mutating state', async () => {
    mockTxQueryRaw.mockResolvedValueOnce([])

    await expect(
      adminArchiveProposalSafely(PROPOSAL_ID, ACTOR_ID, 'Propuesta reportada'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROPOSAL_NOT_FOUND',
    })

    expect(mockRecordAudit).toHaveBeenCalledWith(expect.objectContaining({ result: 'not_found' }))
    expect(mockDelCache).not.toHaveBeenCalled()
  })
})

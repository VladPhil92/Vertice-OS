jest.mock('../../lib/prisma', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  }
  prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => unknown) => work(prisma))
  return { prisma }
})

import { prisma } from '../../lib/prisma'
import {
  getOwnCampaignLifecycle,
  reviewCampaignLifecycle,
  submitOwnCampaignForReview,
  updateOwnCampaignDraft,
} from './crowdfunding.lifecycle.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  creator_citizen_id: '22222222-2222-4222-8222-222222222222',
  title: 'Biblioteca comunitaria',
  slug: 'biblioteca-comunitaria-1234',
  summary: 'Dotación verificable para una biblioteca comunitaria.',
  description: 'Descripción suficientemente extensa para explicar el problema, la solución, el presupuesto, las personas beneficiadas y la rendición de cuentas esperada.',
  category: 'education',
  funding_model: 'donation',
  funding_policy: 'flexible',
  status: 'draft',
  compliance_status: 'pending',
  goal_amount_cop: 1_000_000n,
  raised_amount_cop: 0n,
  currency: 'COP',
  locality_id: null,
  neighborhood: 'Olaya',
  budget: [{ label: 'Libros', amount_cop: 1_000_000 }],
  review_notes: null,
  revision_no: 1,
  submitted_for_review_at: null,
  last_reviewed_at: null,
  last_reviewed_by_citizen_id: null,
  starts_at: null,
  ends_at: null,
  created_at: new Date('2026-09-08T12:00:00.000Z'),
  updated_at: new Date('2026-09-08T12:00:00.000Z'),
}

const INPUT = {
  title: ROW.title,
  summary: ROW.summary,
  description: ROW.description,
  category: 'education',
  funding_model: 'donation',
  funding_policy: 'flexible',
  goal_amount_cop: 1_000_000,
  neighborhood: 'Olaya',
  budget: [{ label: 'Libros', amount_cop: 1_000_000 }],
} as never

beforeEach(() => {
  jest.resetAllMocks()
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (work) => work(prisma))
  mockExecuteRaw.mockResolvedValue(1)
})

describe('getOwnCampaignLifecycle', () => {
  it('returns lifecycle permissions and serialized events', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{
        id: 'evt-1', campaign_id: ROW.id, actor_citizen_id: ROW.creator_citizen_id,
        event_type: 'draft_created', revision_no: 1,
        from_status: null, to_status: 'draft',
        from_compliance_status: null, to_compliance_status: 'pending',
        notes: null, created_at: new Date('2026-09-08T12:00:00.000Z'),
      }])

    const result = await getOwnCampaignLifecycle(ROW.creator_citizen_id, ROW.id)

    expect(result.permissions).toEqual({
      can_edit: true,
      can_submit_for_review: true,
      can_activate: false,
    })
    expect(result.events[0].created_at).toBe('2026-09-08T12:00:00.000Z')
  })
})

describe('updateOwnCampaignDraft', () => {
  it('rejects editing after leaving draft', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...ROW, status: 'review', compliance_status: 'in_review' }])

    await expect(updateOwnCampaignDraft(ROW.creator_citizen_id, ROW.id, INPUT)).rejects.toMatchObject({
      code: 'CAMPAIGN_NOT_EDITABLE', statusCode: 409,
    })
    expect(mockExecuteRaw).not.toHaveBeenCalled()
  })

  it('updates a draft and records an audit event', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{ ...ROW, updated_at: new Date('2026-09-08T13:00:00.000Z') }])

    const result = await updateOwnCampaignDraft(ROW.creator_citizen_id, ROW.id, INPUT)

    expect(result.status).toBe('draft')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })
})

describe('submitOwnCampaignForReview', () => {
  it('moves a draft into formal review and records the transition', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([ROW])
      .mockResolvedValueOnce([{
        ...ROW,
        status: 'review',
        compliance_status: 'in_review',
        submitted_for_review_at: new Date('2026-09-08T13:15:00.000Z'),
      }])

    const result = await submitOwnCampaignForReview(ROW.creator_citizen_id, ROW.id)

    expect(result.status).toBe('review')
    expect(result.compliance_status).toBe('in_review')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('rejects a second submission while already in review', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...ROW, status: 'review', compliance_status: 'in_review' }])

    await expect(submitOwnCampaignForReview(ROW.creator_citizen_id, ROW.id)).rejects.toMatchObject({
      code: 'CAMPAIGN_NOT_SUBMITTABLE', statusCode: 409,
    })
  })
})

describe('reviewCampaignLifecycle', () => {
  it('does not approve a campaign that was never formally submitted', async () => {
    mockQueryRaw.mockResolvedValueOnce([ROW])

    await expect(reviewCampaignLifecycle(
      '33333333-3333-4333-8333-333333333333',
      ROW.id,
      { decision: 'approve' },
    )).rejects.toMatchObject({ code: 'CAMPAIGN_NOT_IN_REVIEW', statusCode: 409 })
  })

  it('returns a campaign to draft when changes are requested', async () => {
    const inReview = { ...ROW, status: 'review', compliance_status: 'in_review' }
    mockQueryRaw
      .mockResolvedValueOnce([inReview])
      .mockResolvedValueOnce([{
        ...ROW,
        status: 'draft',
        compliance_status: 'pending',
        review_notes: 'Aclara el presupuesto y los responsables.',
        last_reviewed_at: new Date('2026-09-08T14:00:00.000Z'),
      }])

    const result = await reviewCampaignLifecycle(
      '33333333-3333-4333-8333-333333333333',
      ROW.id,
      { decision: 'request_changes', notes: 'Aclara el presupuesto y los responsables.' },
    )

    expect(result.status).toBe('draft')
    expect(result.compliance_status).toBe('pending')
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
  })

  it('approves only a formally in-review campaign', async () => {
    const inReview = { ...ROW, status: 'review', compliance_status: 'in_review' }
    mockQueryRaw
      .mockResolvedValueOnce([inReview])
      .mockResolvedValueOnce([{
        ...ROW,
        status: 'verified',
        compliance_status: 'verified',
        last_reviewed_at: new Date('2026-09-08T14:00:00.000Z'),
      }])

    const result = await reviewCampaignLifecycle(
      '33333333-3333-4333-8333-333333333333',
      ROW.id,
      { decision: 'approve' },
    )

    expect(result.status).toBe('verified')
    expect(result.compliance_status).toBe('verified')
  })
})

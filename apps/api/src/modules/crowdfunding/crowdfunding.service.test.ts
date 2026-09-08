jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn() },
}))

import { prisma } from '../../lib/prisma'
import {
  createCampaignDraft,
  getCampaignAnalytics,
  listOwnCampaigns,
  listPublicCampaigns,
} from './crowdfunding.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock

const CAMPAIGN_ROW = {
  id: 'campaign-1',
  creator_citizen_id: 'citizen-1',
  title: 'Parque del barrio',
  slug: 'parque-del-barrio-abcd1234',
  summary: 'Recuperar el parque',
  description: 'Descripción larga de la campaña.',
  category: 'community',
  funding_model: 'donation',
  funding_policy: 'flexible',
  summary: 'Recuperar el parque para la comunidad',
  description: 'Descripción suficientemente larga de la campaña y de su plan de ejecución comunitaria verificable.',
  category: 'community',
  funding_model: 'donation',
  funding_policy: 'milestone',
  status: 'draft',
  compliance_status: 'pending',
  goal_amount_cop: 1_000_000n,
  raised_amount_cop: 0n,
  currency: 'COP',
  locality_id: null,
  neighborhood: null,
  budget: [{ label: 'Materiales', amount_cop: 1_000_000 }],
  budget: [{ label: 'Materiales', amount_cop: 500_000 }],
  starts_at: null,
  ends_at: null,
  created_at: new Date('2026-09-01T00:00:00.000Z'),
  updated_at: new Date('2026-09-01T00:00:00.000Z'),
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('createCampaignDraft', () => {
  it('inserts a draft campaign and serializes bigint amounts and funding policy', async () => {
    mockQueryRaw.mockResolvedValue([CAMPAIGN_ROW])

    const result = await createCampaignDraft('citizen-1', {
      title: 'Parque del barrio',
      summary: 'Recuperar el parque del barrio',
      description: 'Descripción larga de la campaña para recuperar y mejorar el parque comunitario del barrio.',
      category: 'community',
      funding_model: 'donation',
      funding_policy: 'flexible',
      goal_amount_cop: 1_000_000,
      budget: [{ label: 'Materiales', amount_cop: 1_000_000 }],
      summary: 'Recuperar el parque para la comunidad',
      description: 'Descripción suficientemente larga de la campaña y de su plan de ejecución comunitaria verificable.',
      category: 'community',
      funding_model: 'donation',
      funding_policy: 'milestone',
      goal_amount_cop: 1_000_000,
      budget: [{ label: 'Materiales', amount_cop: 500_000 }],
    })

    expect(result.goal_amount_cop).toBe(1_000_000)
    expect(result.raised_amount_cop).toBe(0)
    expect(result.funding_policy).toBe('flexible')
    expect(result.starts_at).toBeNull()
  })

  it('defaults reward campaigns to all-or-nothing policy', async () => {
    mockQueryRaw.mockResolvedValue([{ ...CAMPAIGN_ROW, funding_model: 'reward', funding_policy: 'all_or_nothing' }])

    const result = await createCampaignDraft('citizen-1', {
      title: 'Festival comunitario',
      summary: 'Preventa para un festival comunitario',
      description: 'Campaña de preventa comunitaria con recompensas para financiar la producción responsable del festival.',
      category: 'culture',
      funding_model: 'reward',
      goal_amount_cop: 2_000_000,
      budget: [{ label: 'Producción', amount_cop: 2_000_000 }],
    })

    expect(result.funding_policy).toBe('all_or_nothing')
    expect(result.funding_policy).toBe('milestone')
    expect(result.starts_at).toBeNull()
  })

  it('uses the donation default funding policy when it is omitted', async () => {
    mockQueryRaw.mockResolvedValue([{ ...CAMPAIGN_ROW, funding_policy: 'flexible' }])

    const result = await createCampaignDraft('citizen-1', {
      title: 'Ayuda social urgente',
      summary: 'Apoyo verificable para una necesidad social urgente',
      description: 'Esta campaña describe con suficiente detalle el uso de los recursos, sus responsables y la evidencia requerida.',
      category: 'social',
      funding_model: 'donation',
      goal_amount_cop: 500_000,
      budget: [{ label: 'Ayuda directa', amount_cop: 500_000 }],
    })

    expect(result.funding_policy).toBe('flexible')
  })
})

describe('listOwnCampaigns', () => {
  it('serializes every owned campaign', async () => {
    mockQueryRaw.mockResolvedValue([CAMPAIGN_ROW, { ...CAMPAIGN_ROW, id: 'campaign-2' }])

    const result = await listOwnCampaigns('citizen-1')

    expect(result).toHaveLength(2)
    expect(result[1].id).toBe('campaign-2')
    expect(result[0].funding_policy).toBe('flexible')
  })
})

describe('listPublicCampaigns', () => {
  it('serializes public campaigns', async () => {
    mockQueryRaw.mockResolvedValue([{ ...CAMPAIGN_ROW, status: 'active', compliance_status: 'verified' }])

    const result = await listPublicCampaigns()

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('active')
  })

  it('returns an empty list when there are no public campaigns', async () => {
    mockQueryRaw.mockResolvedValue([])

    const result = await listPublicCampaigns()

    expect(result).toEqual([])
  })
})

describe('getCampaignAnalytics', () => {
  it('converts bigint aggregates to numbers', async () => {
    mockQueryRaw.mockResolvedValue([{
      campaign_count: 3n,
      active_campaign_count: 2n,
      completed_campaign_count: 1n,
      total_goal_cop: 5_000_000n,
      total_raised_cop: 1_200_000n,
      paid_contribution_count: 10n,
      known_supporter_count: 7n,
    }])

    const result = await getCampaignAnalytics('citizen-1')

    expect(result).toEqual({
      campaign_count: 3,
      active_campaign_count: 2,
      completed_campaign_count: 1,
      total_goal_cop: 5_000_000,
      total_raised_cop: 1_200_000,
      paid_contribution_count: 10,
      known_supporter_count: 7,
    })
  })
})
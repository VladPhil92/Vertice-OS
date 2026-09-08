import { createCampaignDraftSchema } from './crowdfunding.schema'
import {
  CROWDFUNDING_CATEGORIES,
  CROWDFUNDING_CATEGORY_CATALOG,
  defaultFundingPolicy,
} from './crowdfunding.policy'

const BASE_DRAFT = {
  title: 'Campaña comunitaria verificable',
  summary: 'Una campaña con propósito, presupuesto y trazabilidad verificables.',
  description: 'Esta descripción explica con suficiente detalle el propósito de la campaña, las personas responsables, el uso esperado de los recursos y la evidencia que se aportará.',
  funding_model: 'donation' as const,
  goal_amount_cop: 1_000_000,
  budget: [{ label: 'Materiales principales', amount_cop: 700_000 }],
}

describe('crowdfunding campaign category and policy contract', () => {
  it('keeps the category catalog aligned with the canonical allowlist', () => {
    expect(CROWDFUNDING_CATEGORY_CATALOG.map((item) => item.id)).toEqual([...CROWDFUNDING_CATEGORIES])
    expect(CROWDFUNDING_CATEGORY_CATALOG).toHaveLength(12)
  })

  it('accepts emergency campaigns', () => {
    const result = createCampaignDraftSchema.safeParse({ ...BASE_DRAFT, category: 'emergency' })
    expect(result.success).toBe(true)
  })

  it('rejects flexible reward campaigns', () => {
    const result = createCampaignDraftSchema.safeParse({
      ...BASE_DRAFT,
      category: 'culture',
      funding_model: 'reward',
      funding_policy: 'flexible',
    })
    expect(result.success).toBe(false)
  })

  it('defaults reward campaigns to all-or-nothing and donations to flexible', () => {
    expect(defaultFundingPolicy('reward')).toBe('all_or_nothing')
    expect(defaultFundingPolicy('donation')).toBe('flexible')
  })

  it('rejects budgets above the fundraising goal', () => {
    const result = createCampaignDraftSchema.safeParse({
      ...BASE_DRAFT,
      category: 'education',
      budget: [{ label: 'Equipos educativos', amount_cop: 1_200_000 }],
    })
    expect(result.success).toBe(false)
  })
})

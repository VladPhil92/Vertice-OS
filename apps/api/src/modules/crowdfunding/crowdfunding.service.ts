import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { defaultFundingPolicy, PUBLIC_CAMPAIGN_STATUSES } from './crowdfunding.policy'
import type { FundingPolicy } from './crowdfunding.policy'
import type { CreateCampaignDraftInput } from './crowdfunding.schema'

type CampaignRow = {
  id: string
  creator_citizen_id: string
  title: string
  slug: string
  summary: string
  description: string
  category: string
  funding_model: string
  funding_policy: FundingPolicy
  status: string
  compliance_status: string
  goal_amount_cop: bigint
  raised_amount_cop: bigint
  currency: string
  locality_id: number | null
  neighborhood: string | null
  budget: unknown
  starts_at: Date | null
  ends_at: Date | null
  created_at: Date
  updated_at: Date
}

type CampaignAnalyticsRow = {
  campaign_count: bigint
  active_campaign_count: bigint
  completed_campaign_count: bigint
  total_goal_cop: bigint
  total_raised_cop: bigint
  paid_contribution_count: bigint
  known_supporter_count: bigint
}

function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)

  return `${normalized || 'causa'}-${randomUUID().slice(0, 8)}`
}

function serializeCampaign(row: CampaignRow) {
  return {
    id: row.id,
    creator_citizen_id: row.creator_citizen_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    category: row.category,
    funding_model: row.funding_model,
    funding_policy: row.funding_policy,
    status: row.status,
    compliance_status: row.compliance_status,
    goal_amount_cop: Number(row.goal_amount_cop),
    raised_amount_cop: Number(row.raised_amount_cop),
    currency: row.currency,
    locality_id: row.locality_id,
    neighborhood: row.neighborhood,
    budget: row.budget,
    starts_at: row.starts_at?.toISOString() ?? null,
    ends_at: row.ends_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  }
}

export async function createCampaignDraft(citizenId: string, input: CreateCampaignDraftInput) {
  const slug = slugify(input.title)
  const budgetJson = JSON.stringify(input.budget)
  const fundingPolicy = input.funding_policy ?? defaultFundingPolicy(input.funding_model)

  const rows = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    INSERT INTO crowdfunding_campaigns (
      creator_citizen_id,
      title,
      slug,
      summary,
      description,
      category,
      funding_model,
      funding_policy,
      status,
      compliance_status,
      goal_amount_cop,
      currency,
      locality_id,
      neighborhood,
      budget
    )
    VALUES (
      ${citizenId}::uuid,
      ${input.title},
      ${slug},
      ${input.summary},
      ${input.description},
      ${input.category},
      ${input.funding_model},
      ${fundingPolicy},
      'draft',
      'pending',
      ${input.goal_amount_cop},
      'COP',
      ${input.locality_id ?? null},
      ${input.neighborhood ?? null},
      ${budgetJson}::jsonb
    )
    RETURNING *
  `)

  return serializeCampaign(rows[0])
}

export async function listOwnCampaigns(citizenId: string) {
  const rows = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT *
    FROM crowdfunding_campaigns
    WHERE creator_citizen_id = ${citizenId}::uuid
    ORDER BY updated_at DESC
    LIMIT 100
  `)

  return rows.map(serializeCampaign)
}

export async function listPublicCampaigns() {
  const publicStatuses = Prisma.join(PUBLIC_CAMPAIGN_STATUSES.map((status) => Prisma.sql`${status}`))
  const rows = await prisma.$queryRaw<CampaignRow[]>(Prisma.sql`
    SELECT *
    FROM crowdfunding_campaigns
    WHERE status IN (${publicStatuses})
      AND compliance_status = 'verified'
    ORDER BY created_at DESC
    LIMIT 100
  `)

  return rows.map(serializeCampaign)
}

export async function getCampaignAnalytics(citizenId: string) {
  const rows = await prisma.$queryRaw<CampaignAnalyticsRow[]>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS campaign_count,
      COUNT(*) FILTER (WHERE status IN ('verified', 'active', 'funded', 'executing', 'verifying'))::bigint AS active_campaign_count,
      COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed_campaign_count,
      COALESCE(SUM(goal_amount_cop), 0)::bigint AS total_goal_cop,
      COALESCE(SUM(raised_amount_cop), 0)::bigint AS total_raised_cop,
      (
        SELECT COUNT(*)::bigint
        FROM crowdfunding_contributions contribution
        JOIN crowdfunding_campaigns owned_campaign ON owned_campaign.id = contribution.campaign_id
        WHERE owned_campaign.creator_citizen_id = ${citizenId}::uuid
          AND contribution.status = 'paid'
      ) AS paid_contribution_count,
      (
        SELECT COUNT(DISTINCT contribution.contributor_citizen_id)::bigint
        FROM crowdfunding_contributions contribution
        JOIN crowdfunding_campaigns owned_campaign ON owned_campaign.id = contribution.campaign_id
        WHERE owned_campaign.creator_citizen_id = ${citizenId}::uuid
          AND contribution.status = 'paid'
          AND contribution.contributor_citizen_id IS NOT NULL
      ) AS known_supporter_count
    FROM crowdfunding_campaigns
    WHERE creator_citizen_id = ${citizenId}::uuid
  `)

  const row = rows[0]
  return {
    campaign_count: Number(row.campaign_count),
    active_campaign_count: Number(row.active_campaign_count),
    completed_campaign_count: Number(row.completed_campaign_count),
    total_goal_cop: Number(row.total_goal_cop),
    total_raised_cop: Number(row.total_raised_cop),
    paid_contribution_count: Number(row.paid_contribution_count),
    known_supporter_count: Number(row.known_supporter_count),
  }
}
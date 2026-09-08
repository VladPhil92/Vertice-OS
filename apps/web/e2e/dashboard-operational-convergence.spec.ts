import { test, expect, type Page } from '@playwright/test'

const citizenId = '550e8400-e29b-41d4-a716-446655440000'
const campaignId = '11111111-1111-4111-8111-111111111111'

const dashboard = {
  profile: { id: citizenId, email: 'lider@example.com', neighborhood: 'Manga', verification_level: 2 },
  reputation: { score: 60, level: 'activo', total_votes: 1, total_proposals: 1, total_reports: 1, badges_count: 0, endorsements_given: 0 },
  attention: { pending_votes: [], legal_needs_action: 0, reports_in_progress: 0, civic_actions_needing_evidence: 0, total_items: 0 },
  mine: {
    civic_actions: { total: 0, active: 0, verified: 0, needs_evidence: 0, awaiting_verification: 0, recent: [] },
    reports: { total: 0, recent: [] },
    proposals: { total: 0, recent: [] },
    workflows: { total: 0, active: 0 },
  },
  city: { reports: { total_reports: 0, by_category: [] }, governance: { by_status: [] } },
  generated_at: '2026-09-08T16:00:00.000Z',
}

async function setupShell(page: Page, activeRole: 'citizen' | 'admin' = 'citizen') {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'operational-convergence-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })

  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: activeRole === 'admin' ? ['citizen', 'admin'] : ['citizen'], active_role: activeRole },
  }))
  await page.route('**/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
    status: 200,
    json: { citizen_id: citizenId, avatar_url: null, status: 'missing', upload_enabled: false },
  }))
  await page.route('**/community/profile/me', (route) => route.fulfill({
    status: 200,
    json: {
      citizen_id: citizenId,
      display_name: 'Lideresa Manga',
      neighborhood: 'Manga',
      profile_type: 'social_leader',
      bio: 'Gestión verificable',
      organization: null,
      public_profile: true,
      reputation_score: 60,
    },
  }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: { total: 0, items: [] } }))
  await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboard }))
}

const config = {
  categoryCatalog: [{ id: 'community', label: 'Comunidad', description: 'Proyecto comunitario', suggestedFundingPolicy: 'flexible' }],
  fundingPolicies: ['flexible', 'all_or_nothing', 'milestone'],
  feePolicy: {
    version: '2026-09-v1',
    socialEmergencyVerifiedPercent: 1,
    standardDonationPercent: 2.5,
    rewardPrepurchasePercent: 3.5,
    tipIsOptional: true,
    providerProcessingFeeIsSeparate: true,
  },
}

const readiness = {
  identity_verified: true,
  verification_status: 'verified',
  payout_status: 'eligible',
  requested_at: '2026-09-08T14:00:00.000Z',
  verified_at: '2026-09-08T15:00:00.000Z',
  review_notes: null,
  can_request_review: false,
  can_activate_campaign: true,
}

test.describe('Dashboard operational convergence Phase 6', () => {
  test('exposes campaign activation and canonical fee policy in the citizen workspace', async ({ page }) => {
    await setupShell(page, 'citizen')

    let active = false
    await page.route('**/crowdfunding/config', (route) => route.fulfill({ status: 200, json: config }))
    await page.route('**/crowdfunding/me/payout-readiness', (route) => route.fulfill({ status: 200, json: readiness }))
    await page.route('**/crowdfunding/me/campaigns', (route) => route.fulfill({
      status: 200,
      json: {
        campaigns: [{
          id: campaignId,
          title: 'Recuperemos el parque',
          summary: 'Campaña comunitaria verificable',
          category: 'community',
          funding_model: 'donation',
          funding_policy: 'flexible',
          status: active ? 'active' : 'verified',
          compliance_status: 'verified',
          goal_amount_cop: 1_000_000,
          raised_amount_cop: 250_000,
          currency: 'COP',
          neighborhood: 'Manga',
          updated_at: '2026-09-08T15:00:00.000Z',
        }],
      },
    }))
    await page.route(`**/crowdfunding/me/campaigns/${campaignId}/activate`, async (route) => {
      active = true
      await route.fulfill({ status: 200, json: { id: campaignId, status: 'active', starts_at: '2026-09-08T16:00:00.000Z', ends_at: null } })
    })

    await page.goto('/dashboard/crowdfunding')

    await expect(page.getByTestId('crowdfunding-operational-center')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gestiona el ciclo completo de tus campañas.' })).toBeVisible()
    await expect(page.getByText('2.5%')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Activar recaudo' })).toBeVisible()

    await page.getByRole('button', { name: 'Activar recaudo' }).click()
    await expect(page.getByText(/Campaña activada/i)).toBeVisible()
    await expect(page.getByText('Recaudando')).toBeVisible()
  })

  test('exposes dedicated admin compliance and payout-profile queues', async ({ page }) => {
    await setupShell(page, 'admin')
    await page.route('**/crowdfunding/admin/review-queue', (route) => route.fulfill({
      status: 200,
      json: {
        campaigns: [{
          id: campaignId,
          creator_citizen_id: citizenId,
          title: 'Biblioteca barrial',
          category: 'education',
          funding_model: 'donation',
          goal_amount_cop: 2_000_000,
          compliance_status: 'pending',
          status: 'draft',
          created_at: '2026-09-08T14:00:00.000Z',
        }],
        payout_profiles: [{
          citizen_id: citizenId,
          verification_status: 'in_review',
          payout_status: 'disabled',
          requested_at: '2026-09-08T14:30:00.000Z',
        }],
      },
    }))

    await page.goto('/dashboard/admin/crowdfunding')

    await expect(page.getByTestId('crowdfunding-admin-operations')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crowdfunding · Compliance y readiness' })).toBeVisible()
    await expect(page.getByText('Biblioteca barrial')).toBeVisible()
    await expect(page.getByPlaceholder(/Referencia verificable KYC\/KYB/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprobar perfil' })).toBeVisible()
  })
})

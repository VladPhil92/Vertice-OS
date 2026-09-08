import { test, expect, type Page } from '@playwright/test'

const citizenId = '550e8400-e29b-41d4-a716-446655440000'

async function setupShell(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'phase7-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
  await page.route('**/api/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen'], active_role: 'citizen' },
  }))
  await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/api/community/profile/me/avatar', (route) => route.fulfill({
    status: 200,
    json: { citizen_id: citizenId, avatar_url: null, status: 'missing', upload_enabled: false },
  }))
  await page.route('**/api/community/profile/me', (route) => route.fulfill({
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
}

test.describe('Phase 7 — Pro usage and community resilience', () => {
  test('billing shows measured usage without inventing unavailable telemetry', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/billing/me', (route) => route.fulfill({
      status: 200,
      json: {
        plan: {
          code: 'free',
          name: 'Vértice Free',
          description: 'Participación sin costo.',
          priceCop: { monthly: 0, annual: 0 },
          entitlements: ['civic:core', 'community:participation'],
          limits: { activeProjects: 3, evidenceStorageMb: 250, aiRequestsPerMonth: 20, scheduledPostsPerMonth: 0 },
        },
        subscription: null,
        reputationNeutrality: { subscriptionChangesScore: false, paymentsChangeScore: false },
      },
    }))
    await page.route('**/api/billing/me/usage', (route) => route.fulfill({
      status: 200,
      json: {
        planCode: 'free',
        period: { start: '2026-09-01', endExclusive: '2026-10-01', timezone: 'America/Bogota' },
        metrics: {
          aiRequestsPerMonth: { used: 12, limit: 20, remaining: 8, percent: 60, enforced: true, source: 'billing_usage_counters' },
          activeProjects: { used: 2, limit: 3, remaining: 1, percent: 67, enforced: false, source: 'civic_actions' },
          evidenceStorageMb: { used: null, limit: 250, remaining: null, percent: null, enforced: false, source: 'capacity_only' },
          scheduledPostsPerMonth: { used: null, limit: 0, remaining: null, percent: null, enforced: false, source: 'capacity_only' },
        },
        neutrality: { usageChangesReputation: false, subscriptionChangesReputation: false },
      },
    }))

    await page.goto('/dashboard/billing')

    const meter = page.getByTestId('billing-usage-meter')
    await expect(meter).toBeVisible()
    await expect(meter).toContainText('12 / 20')
    await expect(meter).toContainText('2 / 3')
    await expect(meter).toContainText('Capacidad: 250 MB')
    await expect(meter).toContainText('no mide este consumo de forma confiable')
    await expect(meter).toContainText('Límite aplicado por backend')
  })

  test('community keeps the surface usable and labels a partial source outage', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/community/feed?limit=1', (route) => route.fulfill({
      status: 200,
      json: {
        data: [],
        count: 0,
        availability: { reports: 'available', proposals: 'unavailable', degraded: true },
      },
    }))
    await page.route('**/api/community/feed?limit=40', (route) => route.fulfill({
      status: 200,
      json: {
        data: [],
        count: 0,
        availability: { reports: 'available', proposals: 'unavailable', degraded: true },
      },
    }))
    await page.route('**/api/community/leaderboard?limit=10', (route) => route.fulfill({ status: 200, json: { data: [], count: 0 } }))

    await page.goto('/dashboard/community')

    const banner = page.getByTestId('community-degraded-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('disponibilidad parcial')
    await expect(banner).toContainText('propuestas')
    await expect(page.getByRole('heading', { name: /Red Cívica/i })).toBeVisible()
  })
})

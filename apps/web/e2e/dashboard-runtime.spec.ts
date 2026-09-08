import { test, expect } from '@playwright/test'

const dashboardPayload = {
  profile: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'citizen@example.com',
    neighborhood: 'Manga',
    verification_level: 2,
  },
  reputation: {
    score: 42,
    level: 'activo',
    total_votes: 3,
    total_proposals: 2,
    total_reports: 8,
    badges_count: 1,
    endorsements_given: 3,
  },
  attention: {
    pending_votes: [],
    legal_needs_action: 0,
    reports_in_progress: 1,
    civic_actions_needing_evidence: 0,
    total_items: 1,
  },
  mine: {
    civic_actions: {
      total: 0,
      active: 0,
      verified: 0,
      needs_evidence: 0,
      awaiting_verification: 0,
      recent: [],
    },
    reports: { total: 0, recent: [] },
    proposals: { total: 0, recent: [] },
    workflows: { total: 0, active: 0 },
  },
  city: {
    reports: { total_reports: 0, by_category: [] },
    governance: { by_status: [] },
  },
  generated_at: '2026-09-07T23:00:00.000Z',
}

const civicProfile = {
  citizen_id: '550e8400-e29b-41d4-a716-446655440000',
  display_name: 'Ciudadano Runtime',
  neighborhood: 'Manga',
  profile_type: 'citizen',
  bio: 'Gestión cívica verificable en Manga.',
  organization: null,
  public_profile: true,
  reputation_score: 42,
}

test('coalesces dashboard consumers into one effective runtime read', async ({ page }) => {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'runtime-test-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })

  let dashboardReads = 0

  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen'], active_role: 'citizen' },
  }))
  await page.route('**/notifications', (route) => route.fulfill({
    status: 200,
    json: { notifications: [], unread: 0 },
  }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
    status: 200,
    json: {
      citizen_id: civicProfile.citizen_id,
      avatar_url: null,
      status: 'missing',
      upload_enabled: false,
    },
  }))
  await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: civicProfile }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({
    status: 200,
    json: { total: 0, items: [] },
  }))
  await page.route('**/dashboard/me', async (route) => {
    dashboardReads += 1
    await route.fulfill({ status: 200, json: dashboardPayload })
  })

  await page.goto('/dashboard')

  await expect(page.getByTestId('dashboard-experience-layer')).toBeVisible()
  await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
  await expect(page.getByText('Ciudadano Runtime')).toBeVisible()
  await expect.poll(() => dashboardReads).toBe(1)
})

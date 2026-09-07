import { test, expect, type Page } from '@playwright/test'

const leaderDashboard = {
  profile: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'leader@example.com',
    neighborhood: 'Manga',
    locality_id: 1,
    verification_level: 2,
    created_at: '2026-09-01T10:00:00.000Z',
  },
  reputation: {
    score: 61,
    level: 'activo',
    total_votes: 2,
    total_proposals: 1,
    total_reports: 4,
    badges_count: 1,
    endorsements_given: 2,
  },
  attention: {
    verification_required: false,
    pending_votes: [{ id: '33333333-3333-4333-8333-333333333333', title: 'Consulta del barrio' }],
    legal_needs_action: 1,
    reports_in_progress: 2,
    civic_actions_needing_evidence: 3,
    total_items: 7,
  },
  mine: {
    civic_actions: { total: 5, active: 3, verified: 2, needs_evidence: 3, awaiting_verification: 0, recent: [] },
    reports: { total: 4, by_status: { in_progress: 2 }, recent: [] },
    proposals: { total: 1, by_status: {}, recent: [] },
    legal: { total: 1, by_status: { draft: 1 }, recent: [] },
    workflows: { total: 2, active: 1, recent: [] },
  },
  city: {
    reports: { total_reports: 20, open_reports: 5, by_category: [] },
    governance: { total_proposals: 3, by_status: [] },
  },
  generated_at: '2026-09-07T13:00:00.000Z',
}

const leaderCivicProfile = {
  citizen_id: '550e8400-e29b-41d4-a716-446655440000',
  display_name: 'Líder Manga',
  neighborhood: 'Manga',
  profile_type: 'social_leader',
  bio: 'Liderazgo comunitario enfocado en espacio público.',
  organization: 'Manga Activa',
  public_profile: true,
  reputation_score: 61,
}

async function authenticate(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

async function mockShell(page: Page) {
  await page.route('**/auth/roles', (route) => route.fulfill({ status: 200, json: { assigned_roles: ['citizen'], active_role: 'citizen' } }))
  await page.route('**/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: { total: 0, items: [] } }))
}

test.describe('Dashboard Experience Convergence v6', () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page)
    await mockShell(page)
  })

  test('adapts the command layer to a social leader and exposes one prioritized action center', async ({ page }) => {
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: leaderDashboard }))
    await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: leaderCivicProfile }))
    await page.goto('/dashboard')

    const experience = page.getByTestId('dashboard-experience-layer')
    await expect(experience).toBeVisible()
    await expect(experience.getByText('Liderazgo social', { exact: true })).toBeVisible()
    await expect(experience.getByRole('heading', { name: /convierte trabajo comunitario en resultados/i })).toBeVisible()
    await expect(experience.getByText('Manga Activa', { exact: true })).toBeVisible()
    await expect(experience.getByText('100%', { exact: true })).toBeVisible()

    const center = page.getByTestId('unified-action-center')
    await expect(center).toBeVisible()
    await expect(center.getByText('Acciones que necesitan evidencia', { exact: true })).toBeVisible()
    await expect(center.getByText('Consultas pendientes', { exact: true })).toBeVisible()
    await expect(center.getByText('Control público por completar', { exact: true })).toBeVisible()
    await expect(center.getByText('Reportes en seguimiento', { exact: true })).toBeVisible()
    await expect(experience.getByRole('link', { name: /gestionar mis acciones/i })).toHaveAttribute('href', '/dashboard/community/actions')
    await expect(center.getByRole('link', { name: /acciones que necesitan evidencia/i })).toHaveAttribute('href', '/dashboard/community/actions')
  })

  test('turns missing identity and civic-profile setup into explicit onboarding work without blocking the dashboard', async ({ page }) => {
    const incompleteDashboard = {
      ...leaderDashboard,
      profile: { ...leaderDashboard.profile, verification_level: 0, neighborhood: null },
      attention: {
        verification_required: true,
        pending_votes: [],
        legal_needs_action: 0,
        reports_in_progress: 0,
        civic_actions_needing_evidence: 0,
        total_items: 1,
      },
    }
    const incompleteCivicProfile = {
      ...leaderCivicProfile,
      neighborhood: null,
      profile_type: 'citizen',
      bio: null,
      organization: null,
      public_profile: false,
      reputation_score: 0,
    }

    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: incompleteDashboard }))
    await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: incompleteCivicProfile }))
    await page.goto('/dashboard')

    const experience = page.getByTestId('dashboard-experience-layer')
    await expect(experience.getByText('Ciudadanía', { exact: true })).toBeVisible()
    await expect(experience.getByText('10%', { exact: true })).toBeVisible()

    const center = page.getByTestId('unified-action-center')
    await expect(center.getByText('Completar verificación básica', { exact: true })).toBeVisible()
    await expect(center.getByText('Completar presencia cívica', { exact: true })).toBeVisible()
    await expect(center.getByRole('link', { name: /completar verificación básica/i })).toHaveAttribute('href', '/dashboard/identity')
    await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
  })

  test('deduplicates concurrent dashboard reads while keeping independent surfaces resilient', async ({ page }) => {
    let dashboardReads = 0

    await page.route('**/dashboard/me', async (route) => {
      dashboardReads += 1
      await new Promise((resolve) => setTimeout(resolve, 75))
      await route.fulfill({ status: 200, json: leaderDashboard })
    })
    await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: leaderCivicProfile }))

    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-experience-layer')).toBeVisible()
    await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
    await expect.poll(() => dashboardReads).toBe(1)
  })

  test('groups desktop navigation by user intent and marks the current route semantically', async ({ page }) => {
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: leaderDashboard }))
    await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: leaderCivicProfile }))

    await page.goto('/dashboard')

    const navigation = page.getByRole('navigation', { name: 'Navegación principal del dashboard' })
    await expect(navigation.getByText('Principal', { exact: true })).toBeVisible()
    await expect(navigation.getByText('Participación', { exact: true })).toBeVisible()
    await expect(navigation.getByText('Herramientas', { exact: true })).toBeVisible()
    await expect(navigation.getByText('Cuenta', { exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })
})

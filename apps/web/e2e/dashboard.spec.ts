import { test, expect, type Page } from '@playwright/test'

const dashboardPayload = {
  profile: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'citizen@example.com',
    neighborhood: 'Manga',
    locality_id: 1,
    verification_level: 1,
    created_at: '2026-09-01T10:00:00.000Z',
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
    verification_required: false,
    pending_votes: [],
    legal_needs_action: 0,
    reports_in_progress: 1,
    civic_actions_needing_evidence: 1,
    total_items: 2,
  },
  mine: {
    civic_actions: {
      total: 4,
      active: 2,
      verified: 1,
      needs_evidence: 1,
      awaiting_verification: 1,
      recent: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Recuperación participativa del parque de Manga',
          category: 'espacio público',
          neighborhood: 'Manga',
          status: 'in_progress',
          civic_score: 67,
          confidence_score: 74,
          confidence_level: 'high',
          evidence_level: 3,
          evidence_count: 4,
          updated_at: '2026-09-06T18:00:00.000Z',
          community_validation: { corroborations: 3, disputes: 0, total: 3 },
        },
      ],
    },
    reports: {
      total: 8,
      by_status: { open: 7, in_progress: 1 },
      recent: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Luminaria averiada en la avenida',
          category: 'servicios_publicos',
          status: 'in_progress',
          neighborhood: 'Manga',
          created_at: '2026-09-04T12:00:00.000Z',
          updated_at: '2026-09-06T12:00:00.000Z',
        },
      ],
    },
    proposals: {
      total: 2,
      by_status: { idea: 1, debate: 1 },
      recent: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Corredor seguro para peatones',
          category: 'movilidad',
          scope: 'neighborhood',
          status: 'debate',
          endorsement_count: 12,
          total_votes: 0,
          voting_ends_at: null,
          created_at: '2026-09-03T12:00:00.000Z',
        },
      ],
    },
    legal: { total: 0, by_status: {}, recent: [] },
    workflows: { total: 3, active: 2, recent: [] },
  },
  city: {
    reports: {
      total_reports: 87,
      open_reports: 34,
      by_category: [
        { category: 'servicios_publicos', total: 20, open_count: 8, resolved_count: 12 },
      ],
    },
    governance: {
      total_proposals: 23,
      by_status: [{ status: 'voting', count: 3 }],
    },
  },
  generated_at: '2026-09-06T18:30:00.000Z',
}

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

async function setupSupportingRoutes(page: Page) {
  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen'], active_role: 'citizen' },
  }))
  await page.route('**/notifications', (route) => route.fulfill({
    status: 200,
    json: { notifications: [], unread: 0 },
  }))
}

async function mockDashboard(page: Page, payload = dashboardPayload) {
  await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: payload }))
}

test.describe('Citizen command center', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await setupSupportingRoutes(page)
  })

  test('renders civic actions as a first-class dashboard workflow', async ({ page }) => {
    await mockDashboard(page)
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
    await expect(page.getByTestId('civic-action-hub')).toBeVisible()
    await expect(page.getByText('Recuperación participativa del parque de Manga')).toBeVisible()
    await expect(page.getByText(/seguidores, likes e impresiones no suman reputación/i)).toBeVisible()

    const createAction = page.getByRole('link', { name: /crear acción cívica/i }).first()
    await expect(createAction).toHaveAttribute('href', '/dashboard/community/actions/new')
    await expect(page.getByRole('link', { name: /recuperación participativa del parque de manga/i })).toHaveAttribute(
      'href',
      '/dashboard/community/actions/11111111-1111-4111-8111-111111111111',
    )
  })

  test('keeps civic action creation distinct from territorial reporting', async ({ page }) => {
    await mockDashboard(page)
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: /crear acción cívica/i }).first()).toHaveAttribute(
      'href',
      '/dashboard/community/actions/new',
    )
    await expect(page.getByRole('link', { name: /reportar situación/i }).first()).toHaveAttribute(
      'href',
      '/dashboard/reports/new',
    )
    await expect(page.getByText(/acciones sin evidencia suficiente/i)).toBeVisible()
  })

  test('shows an actionable empty state when the citizen has no civic actions', async ({ page }) => {
    await mockDashboard(page, {
      ...dashboardPayload,
      attention: { ...dashboardPayload.attention, civic_actions_needing_evidence: 0, total_items: 1 },
      mine: {
        ...dashboardPayload.mine,
        civic_actions: {
          total: 0,
          active: 0,
          verified: 0,
          needs_evidence: 0,
          awaiting_verification: 0,
          recent: [],
        },
      },
    })
    await page.goto('/dashboard')

    await expect(page.getByText(/aún no has creado acciones cívicas/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /crear primera acción/i })).toHaveAttribute(
      'href',
      '/dashboard/community/actions/new',
    )
  })

  test('renders a recoverable error state when dashboard API fails', async ({ page }) => {
    await page.route('**/dashboard/me', (route) => route.fulfill({
      status: 503,
      json: { error: 'Dashboard temporalmente no disponible' },
    }))
    await page.goto('/dashboard')

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('heading', { name: /no pudimos abrir tu centro ciudadano/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /reintentar/i })).toBeVisible()
  })

  test('routes the mobile primary action to civic action creation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockDashboard(page)
    await page.goto('/dashboard')

    const mobileAction = page.getByRole('link', { name: 'Acción', exact: true })
    await expect(mobileAction).toBeVisible()
    await expect(mobileAction).toHaveAttribute('href', '/dashboard/community/actions/new')
  })
})

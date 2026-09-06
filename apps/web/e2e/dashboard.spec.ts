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

const resolutionPlanPayload = {
  total: 3,
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Recuperación del parque disputada',
      status: 'disputed',
      updated_at: '2026-09-06T18:00:00.000Z',
      evidence_count: 2,
      next_step: 'reopen_execution',
      next_step_label: 'Reabrir ejecución',
      detail: 'La acción fue disputada o quedó sin evidencia suficiente. Reabre la ejecución antes de corregirla.',
      follow_up_label: 'Después: incorpora evidencia nueva o corregida.',
      priority: 'urgent',
      href: '/dashboard/community/actions/44444444-4444-4444-8444-444444444444',
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Resultado comunitario pendiente de soporte',
      status: 'result_declared',
      updated_at: '2026-09-05T18:00:00.000Z',
      evidence_count: 0,
      next_step: 'attach_evidence',
      next_step_label: 'Adjuntar evidencia del resultado',
      detail: 'El resultado ya fue declarado, pero todavía no tiene evidencia admisible que lo respalde.',
      follow_up_label: 'Después: la acción queda lista para revisión de evidencia.',
      priority: 'high',
      href: '/dashboard/community/actions/55555555-5555-4555-8555-555555555555',
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      title: 'Jornada documentada lista para cierre',
      status: 'in_progress',
      updated_at: '2026-09-04T18:00:00.000Z',
      evidence_count: 3,
      next_step: 'declare_result',
      next_step_label: 'Declarar resultado',
      detail: 'La acción ya tiene evidencia admisible y puede avanzar desde ejecución hacia un resultado observable.',
      follow_up_label: 'Después: el resultado y su evidencia podrán pasar a revisión.',
      priority: 'normal',
      href: '/dashboard/community/actions/66666666-6666-4666-8666-666666666666',
    },
  ],
}

async function setupAuth(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', url: baseURL },
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

async function mockResolution(page: Page, payload = resolutionPlanPayload) {
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: payload }))
}

async function mockDashboard(
  page: Page,
  payload = dashboardPayload,
  resolutionPayload = resolutionPlanPayload,
) {
  await mockResolution(page, resolutionPayload)
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

  test('renders exact lifecycle steps and keeps evidence upload in the traceable workspace', async ({ page }) => {
    await mockDashboard(page)
    await page.goto('/dashboard')

    await expect(page.getByTestId('action-resolution-plan')).toBeVisible()
    await expect(page.getByRole('heading', { name: /completa el siguiente paso de 3 acciones/i })).toBeVisible()
    await expect(page.getByText('Reabrir ejecución')).toBeVisible()
    await expect(page.getByText('Adjuntar evidencia del resultado')).toBeVisible()
    await expect(page.getByText('Declarar resultado')).toBeVisible()
    await expect(page.getByText(/después: incorpora evidencia nueva o corregida/i)).toBeVisible()

    await expect(page.getByRole('button', { name: /reabrir ahora/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /declarar resultado ahora/i })).toBeVisible()
    await expect(page.getByRole('link', {
      name: /adjuntar evidencia en workspace: resultado comunitario pendiente de soporte/i,
    })).toHaveAttribute(
      'href',
      '/dashboard/community/actions/55555555-5555-4555-8555-555555555555',
    )
    await expect(page.getByRole('link', {
      name: /abrir workspace: recuperación del parque disputada/i,
    })).toHaveAttribute(
      'href',
      '/dashboard/community/actions/44444444-4444-4444-8444-444444444444',
    )
  })

  test('reopens a disputed action only after explicit confirmation and recalculates its next step', async ({ page }) => {
    let currentPlan = resolutionPlanPayload
    let patchBody: unknown = null

    await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: currentPlan }))
    await page.route('**/civic-actions/44444444-4444-4444-8444-444444444444', async (route) => {
      patchBody = route.request().postDataJSON()
      currentPlan = {
        total: 3,
        items: [
          {
            ...resolutionPlanPayload.items[0],
            status: 'in_progress',
            next_step: 'declare_result',
            next_step_label: 'Declarar resultado',
            detail: 'La acción ya tiene evidencia admisible y puede avanzar desde ejecución hacia un resultado observable.',
            follow_up_label: 'Después: el resultado y su evidencia podrán pasar a revisión.',
            priority: 'normal',
          },
          resolutionPlanPayload.items[1],
          resolutionPlanPayload.items[2],
        ],
      }
      await route.fulfill({ status: 200, json: { id: resolutionPlanPayload.items[0].id, status: 'in_progress' } })
    })
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboardPayload }))

    await page.goto('/dashboard')
    const card = page.getByTestId('resolution-item-44444444-4444-4444-8444-444444444444')
    await card.getByRole('button', { name: /reabrir ahora/i }).click()

    await expect(card.getByText(/confirma que quieres devolver esta acción a ejecución/i)).toBeVisible()
    expect(patchBody).toBeNull()

    await card.getByRole('button', { name: /confirmar reabrir/i }).click()

    await expect.poll(() => patchBody).toEqual({ status: 'in_progress' })
    await expect(card.getByText('Declarar resultado')).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText(/volvió a ejecución. el plan fue recalculado/i)).toBeVisible()
  })

  test('declares an observable result inline and validates the minimum summary before mutation', async ({ page }) => {
    let currentPlan = resolutionPlanPayload
    let patchBody: unknown = null
    let patchCalls = 0

    await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: currentPlan }))
    await page.route('**/civic-actions/66666666-6666-4666-8666-666666666666', async (route) => {
      patchCalls += 1
      patchBody = route.request().postDataJSON()
      currentPlan = {
        total: 2,
        items: [resolutionPlanPayload.items[0], resolutionPlanPayload.items[1]],
      }
      await route.fulfill({ status: 200, json: { id: resolutionPlanPayload.items[2].id, status: 'result_declared' } })
    })
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboardPayload }))

    await page.goto('/dashboard')
    const card = page.getByTestId('resolution-item-66666666-6666-4666-8666-666666666666')
    await card.getByRole('button', { name: /declarar resultado ahora/i }).click()

    const resultInput = card.getByLabel(/resultado observable/i)
    await resultInput.fill('corto')
    await card.getByRole('button', { name: /confirmar resultado/i }).click()
    await expect(card.getByRole('alert')).toContainText(/al menos 10 caracteres/i)
    expect(patchCalls).toBe(0)

    const summary = 'Se recuperó el parque y quedó habilitado para uso comunitario.'
    await resultInput.fill(summary)
    await card.getByRole('button', { name: /confirmar resultado/i }).click()

    await expect.poll(() => patchBody).toEqual({
      status: 'result_declared',
      result_summary: summary,
    })
    await expect(page.getByTestId('resolution-item-66666666-6666-4666-8666-666666666666')).toHaveCount(0)
    await expect(page.getByText(/resultado declarado para/i)).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('isolates a rejected quick execution without breaking the citizen command center', async ({ page }) => {
    await mockDashboard(page)
    await page.route('**/civic-actions/44444444-4444-4444-8444-444444444444', (route) => route.fulfill({
      status: 409,
      json: { error: 'Transición no permitida en el estado actual' },
    }))
    await page.goto('/dashboard')

    const card = page.getByTestId('resolution-item-44444444-4444-4444-8444-444444444444')
    await card.getByRole('button', { name: /reabrir ahora/i }).click()
    await card.getByRole('button', { name: /confirmar reabrir/i }).click()

    await expect(card.getByRole('alert')).toContainText(/transición no permitida/i)
    await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
    await expect(card).toBeVisible()
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
    await mockDashboard(
      page,
      {
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
      },
      { total: 0, items: [] },
    )
    await page.goto('/dashboard')

    await expect(page.getByTestId('action-resolution-plan')).toHaveCount(0)
    await expect(page.getByText(/aún no has creado acciones cívicas/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /crear primera acción/i })).toHaveAttribute(
      'href',
      '/dashboard/community/actions/new',
    )
  })

  test('keeps the main dashboard usable when the resolution plan fails', async ({ page }) => {
    await page.route('**/dashboard/me/resolution', (route) => route.fulfill({
      status: 503,
      json: { error: 'Plan temporalmente no disponible' },
    }))
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboardPayload }))
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /convierte gestión en evidencia pública/i })).toBeVisible()
    await expect(page.getByText(/el centro ciudadano sigue disponible/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /reintentar/i }).first()).toBeVisible()
  })

  test('renders a recoverable error state when dashboard API fails', async ({ page }) => {
    await mockResolution(page, { total: 0, items: [] })
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

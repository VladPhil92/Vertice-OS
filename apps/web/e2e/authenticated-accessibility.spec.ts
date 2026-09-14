import { expect, test, type Page } from '@playwright/test'

const API = '**/api'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440010'

async function setupAuthenticatedDashboard(page: Page, options: { failMarkOne?: boolean } = {}) {
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' }])
  await page.addInitScript((citizenId) => {
    localStorage.setItem('access_token', 'golden-browser-token')
    localStorage.setItem('citizen_id', citizenId)
  }, CITIZEN_ID)

  await page.route(`${API}/community/profile/me/avatar`, (route) => route.fulfill({
    status: 200,
    json: {
      citizen_id: CITIZEN_ID,
      avatar_url: null,
      status: 'missing',
      upload_enabled: true,
    },
  }))

  await page.route(`${API}/community/profile/me`, (route) => route.fulfill({
    status: 200,
    json: {
      citizen_id: CITIZEN_ID,
      display_name: 'Ciudadana Golden',
      neighborhood: 'Centro',
      profile_type: 'citizen',
      bio: null,
      organization: null,
      public_profile: true,
      reputation_score: 72,
    },
  }))

  await page.route(`${API}/dashboard/me/resolution`, (route) => route.fulfill({
    status: 200,
    json: { total: 0, items: [] },
  }))

  await page.route(`${API}/dashboard/me`, (route) => route.fulfill({
    status: 200,
    json: {
      profile: {
        id: CITIZEN_ID,
        email: 'golden@vertice.test',
        neighborhood: 'Centro',
        verification_level: 1,
        territory_code: '68001',
        territory_name: 'Bucaramanga',
        territory_level: 'municipality',
        department_code: '68',
        department_name: 'Santander',
        territory_activation_status: 'active',
      },
      reputation: {
        score: 72,
        level: 'active',
        total_votes: 3,
        total_proposals: 1,
        total_reports: 2,
        badges_count: 1,
        endorsements_given: 2,
      },
      attention: {
        pending_votes: [],
        legal_needs_action: 0,
        reports_in_progress: 0,
        civic_actions_needing_evidence: 0,
        total_items: 0,
      },
      mine: {
        civic_actions: { total: 0, active: 0, verified: 0, needs_evidence: 0, awaiting_verification: 0, recent: [] },
        reports: { total: 0, recent: [] },
        proposals: { total: 0, recent: [] },
        workflows: { total: 0, active: 0 },
      },
      city: {
        reports: { total_reports: 0, by_category: [] },
        governance: { by_status: [] },
      },
      generated_at: '2026-09-14T11:00:00.000Z',
    },
  }))

  await page.route(`${API}/auth/roles`, (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen'], active_role: 'citizen' },
  }))

  await page.route(`${API}/notifications`, (route) => route.fulfill({
    status: 200,
    json: {
      unread: 1,
      notifications: [{
        id: NOTIFICATION_ID,
        type: 'report_status',
        title: 'Gestión actualizada',
        body: 'Tu reporte cambió de estado y requiere seguimiento.',
        href: '/dashboard/reports',
        read: false,
        createdAt: 1_789_376_400_000,
      }],
    },
  }))

  await page.route(`${API}/notifications/read-all`, (route) => route.fulfill({ status: 204, body: '' }))
  await page.route(`${API}/notifications/${NOTIFICATION_ID}/read`, (route) => {
    if (options.failMarkOne) {
      return route.fulfill({ status: 503, json: { error: 'Servicio temporalmente no disponible' } })
    }
    return route.fulfill({ status: 204, body: '' })
  })
}

test.describe('@golden authenticated accessibility and release UX', () => {
  test('@golden GJ-B07 notification surfaces expose state and restore focus on Escape', async ({ page }) => {
    await setupAuthenticatedDashboard(page)
    await page.goto('/dashboard/notifications')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Notificaciones y siguientes pasos' })).toBeVisible()

    const allFilter = page.getByRole('button', { name: 'Todas', exact: true })
    const unreadFilter = page.getByRole('button', { name: 'Sin leer', exact: true })
    await expect(allFilter).toHaveAttribute('aria-pressed', 'true')
    await expect(unreadFilter).toHaveAttribute('aria-pressed', 'false')
    await unreadFilter.click()
    await expect(unreadFilter).toHaveAttribute('aria-pressed', 'true')
    await expect(allFilter).toHaveAttribute('aria-pressed', 'false')

    const bell = page.getByRole('button', { name: 'Notificaciones, 1 sin leer' })
    await expect(bell).toHaveAttribute('aria-expanded', 'false')
    await bell.focus()
    await page.keyboard.press('Enter')
    await expect(bell).toHaveAttribute('aria-expanded', 'true')

    const dialog = page.getByRole('dialog', { name: 'Notificaciones' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cerrar notificaciones' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(bell).toHaveAttribute('aria-expanded', 'false')
    await expect(bell).toBeFocused()
  })

  test('@golden GJ-B08 notification mutation failures surface as an alert without discarding results', async ({ page }) => {
    await setupAuthenticatedDashboard(page, { failMarkOne: true })
    await page.goto('/dashboard/notifications')

    const markRead = page.getByRole('button', { name: 'Marcar como leída', exact: true })
    await expect(markRead).toBeVisible()
    await markRead.click()

    const operationalAlert = page.locator('#notification-results').getByRole('alert')
    await expect(operationalAlert).toContainText(/servicio temporalmente no disponible|no fue posible marcar/i)
    await expect(page.getByRole('heading', { level: 2, name: 'Gestión actualizada' })).toBeVisible()
    await expect(markRead).toBeVisible()
  })
})

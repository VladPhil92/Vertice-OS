import { test, expect, type Page } from '@playwright/test'

const profile = {
  citizen_id: '550e8400-e29b-41d4-a716-446655440000',
  display_name: 'Lideresa Manga',
  neighborhood: 'Manga',
  profile_type: 'social_leader',
  bio: 'Gestión comunitaria verificable.',
  organization: 'Red de Manga',
  public_profile: true,
  reputation_score: 64,
}

const dashboard = {
  profile: {
    id: profile.citizen_id,
    email: 'lideresa@example.com',
    neighborhood: 'Manga',
    verification_level: 2,
  },
  reputation: {
    score: 64,
    level: 'activo',
    total_votes: 4,
    total_proposals: 2,
    total_reports: 7,
    badges_count: 2,
    endorsements_given: 3,
  },
  attention: {
    pending_votes: [],
    legal_needs_action: 0,
    reports_in_progress: 2,
    civic_actions_needing_evidence: 1,
    total_items: 3,
  },
  mine: {
    civic_actions: {
      total: 3,
      active: 2,
      verified: 1,
      needs_evidence: 1,
      awaiting_verification: 0,
      recent: [{
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Recuperación del parque de Manga',
        category: 'espacio_publico',
        neighborhood: 'Manga',
        status: 'in_progress',
        civic_score: 71,
        confidence_score: 80,
        evidence_count: 4,
        updated_at: '2026-09-08T10:00:00.000Z',
      }],
    },
    reports: {
      total: 7,
      recent: [{
        id: '22222222-2222-4222-8222-222222222222',
        title: 'Luminaria averiada en la avenida',
        status: 'in_progress',
        neighborhood: 'Manga',
        updated_at: '2026-09-08T09:00:00.000Z',
      }],
    },
    proposals: {
      total: 2,
      recent: [{
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Corredor peatonal seguro',
        status: 'debate',
        endorsement_count: 10,
        total_votes: 0,
        created_at: '2026-09-07T15:00:00.000Z',
      }],
    },
    workflows: { total: 1, active: 1 },
  },
  city: {
    reports: {
      total_reports: 91,
      by_category: [
        { resolved_count: 12 },
        { resolved_count: 8 },
      ],
    },
    governance: {
      by_status: [{ status: 'voting', count: 3 }],
    },
  },
  generated_at: '2026-09-08T11:30:00.000Z',
}

const resolutionPlan = {
  total: 1,
  items: [{
    id: '44444444-4444-4444-8444-444444444444',
    title: 'Jornada comunitaria pendiente de cierre',
    status: 'in_progress',
    updated_at: '2026-09-08T10:30:00.000Z',
    evidence_count: 3,
    next_step: 'declare_result',
    next_step_label: 'Declarar resultado',
    detail: 'La acción ya cuenta con evidencia admisible.',
    follow_up_label: 'Después: el resultado podrá pasar a revisión.',
    priority: 'normal',
    href: '/dashboard/community/actions/44444444-4444-4444-8444-444444444444',
  }],
}

async function setup(page: Page, plan = resolutionPlan) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'command-center-v2-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })

  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen', 'social_leader'], active_role: 'social_leader' },
  }))
  await page.route('**/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
    status: 200,
    json: { citizen_id: profile.citizen_id, avatar_url: null, status: 'missing', upload_enabled: false },
  }))
  await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: profile }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: plan }))
  await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboard }))
}

test.describe('Dashboard Command Center v2', () => {
  test('converges the homepage into one operational hierarchy', async ({ page }) => {
    await setup(page)
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-command-center-v2')).toBeVisible()
    await expect(page.getByTestId('dashboard-identity-header')).toHaveCount(0)
    await expect(page.getByTestId('dashboard-experience-layer')).toHaveCount(0)

    await expect(page.getByText('Siguiente mejor acción')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Resolver acciones abiertas' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Centro de pendientes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Gestión en seguimiento' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tu territorio' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tu historial reciente' })).toBeVisible()

    await expect(page.getByTestId('civic-action-hub').getByText('Recuperación del parque de Manga')).toBeVisible()
    await expect(page.getByText('Luminaria averiada en la avenida')).toBeVisible()
    await expect(page.getByText('Corredor peatonal seguro')).toBeVisible()
    await expect(page.getByTestId('action-resolution-plan')).toBeVisible()
  })

  test('falls back to creation when there is nothing requiring attention', async ({ page }) => {
    const quietDashboard = {
      ...dashboard,
      attention: {
        pending_votes: [],
        legal_needs_action: 0,
        reports_in_progress: 0,
        civic_actions_needing_evidence: 0,
        total_items: 0,
      },
    }

    await setup(page, { total: 0, items: [] })
    await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: quietDashboard }))
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Crear una nueva acción cívica' })).toBeVisible()
    await expect(page.getByRole('link', { name: /resolver ahora/i })).toHaveAttribute('href', '/dashboard/community/actions/new')
    await expect(page.getByText(/sin pendientes críticos/i)).toBeVisible()
  })
})
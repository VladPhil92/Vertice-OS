import { test, expect, type Page } from '@playwright/test'

const citizenId = '550e8400-e29b-41d4-a716-446655440000'

const dashboard = {
  profile: { id: citizenId, email: 'lider@example.com', neighborhood: 'Manga', verification_level: 2 },
  reputation: { score: 60, level: 'activo', total_votes: 2, total_proposals: 1, total_reports: 3, badges_count: 0, endorsements_given: 0 },
  attention: { pending_votes: [], legal_needs_action: 0, reports_in_progress: 0, civic_actions_needing_evidence: 0, total_items: 0 },
  mine: {
    civic_actions: { total: 2, active: 1, verified: 1, needs_evidence: 0, awaiting_verification: 0, recent: [] },
    reports: { total: 3, recent: [] },
    proposals: { total: 1, recent: [] },
    workflows: { total: 1, active: 1 },
  },
  city: { reports: { total_reports: 0, by_category: [] }, governance: { by_status: [] } },
  generated_at: '2026-09-08T16:00:00.000Z',
}

async function setupShell(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'phase6b-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
  await page.route('**/auth/roles', (route) => route.fulfill({ status: 200, json: { assigned_roles: ['citizen'], active_role: 'citizen' } }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, avatar_url: null, status: 'missing', upload_enabled: false } }))
  await page.route('**/community/profile/me', (route) => route.fulfill({
    status: 200,
    json: { citizen_id: citizenId, display_name: 'Lideresa Manga', neighborhood: 'Manga', profile_type: 'social_leader', bio: 'Gestión verificable', organization: null, public_profile: true, reputation_score: 60 },
  }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: { total: 0, items: [] } }))
  await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: dashboard }))
}

const caseResponse = {
  data: [{
    id: '22222222-2222-4222-8222-222222222222',
    stage: 'analysis',
    stored_stage: 'analysis',
    created_at: '2026-09-07T12:00:00.000Z',
    updated_at: '2026-09-08T14:00:00.000Z',
    report: { id: '33333333-3333-4333-8333-333333333333', title: 'Iluminación parque Manga', category: 'infraestructura', status: 'open', neighborhood: 'Manga', created_at: '2026-09-07T12:00:00.000Z' },
    analysis: null,
    proposal: null,
    control: null,
  }],
  count: 1,
}

test.describe('Dashboard operational convergence Phase 6b', () => {
  test('homepage exposes command search and role-adaptive actions', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
    await page.route('**/crowdfunding/me/payout-readiness', (route) => route.fulfill({ status: 200, json: { identity_verified: true, verification_status: 'verified', payout_status: 'eligible', can_request_review: false, can_activate_campaign: false } }))
    await page.route('**/crowdfunding/me/campaigns', (route) => route.fulfill({ status: 200, json: { campaigns: [] } }))
    await page.route('**/billing/me', (route) => route.fulfill({ status: 200, json: { plan: { code: 'free' }, subscription: null } }))
    await page.route('**/workflows/cases?limit=25', (route) => route.fulfill({ status: 200, json: caseResponse }))
    await page.route('**/community/feed?limit=40', (route) => route.fulfill({ status: 200, json: { data: [{ id: '33333333-3333-4333-8333-333333333333', type: 'report', title: 'Iluminación parque Manga', summary: 'Luminarias dañadas', neighborhood: 'Manga', href: '/dashboard/reports/33333333-3333-4333-8333-333333333333', actor: { id: citizenId, display_name: 'Lideresa Manga', public_profile: true } }], count: 1 } }))

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-global-search-trigger')).toBeVisible()
    await expect(page.getByTestId('role-adaptive-launcher')).toContainText('Registrar gestión')

    await page.getByTestId('dashboard-global-search-trigger').click()
    await page.getByPlaceholder('Escribe para buscar…').fill('Iluminación')
    await expect(page.getByRole('link', { name: /Iluminación parque Manga/i }).first()).toBeVisible()
  })

  test('notification inbox separates operational categories', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/notifications', (route) => route.fulfill({
      status: 200,
      json: {
        unread: 2,
        notifications: [
          { id: 'n1', type: 'report_status', title: 'Reporte actualizado', body: 'Tu reporte cambió de estado.', href: '/dashboard/reports', read: false, createdAt: Date.now() },
          { id: 'n2', type: 'payout', title: 'Desembolso requiere atención', body: 'Revisa el estado del payout.', href: '/dashboard/crowdfunding', read: false, createdAt: Date.now() },
        ],
      },
    }))

    await page.goto('/dashboard/notifications')
    await expect(page.getByTestId('notification-operational-inbox')).toBeVisible()
    await expect(page.getByText('Reporte actualizado')).toBeVisible()
    await page.getByRole('button', { name: 'Financieras' }).click()
    await expect(page.getByText('Desembolso requiere atención')).toBeVisible()
    await expect(page.getByText('Reporte actualizado')).not.toBeVisible()
  })

  test('reputation presents evidence impact separately from legacy participation', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
    await page.route('**/auth/me', (route) => route.fulfill({ status: 200, json: { id: citizenId, did: 'did:vertice:test', email: 'lider@example.com', neighborhood: 'Manga', locality_id: 1, reputation_score: '60', verification_level: 2, created_at: '2026-01-01T00:00:00.000Z', last_active_at: null } }))
    await page.route('**/identity/status', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, did: 'did:vertice:test', level: 2, level_name: 'contacto_verificado', can_vote: true, can_propose: true } }))
    await page.route('**/reputation/me/analytics', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, score_history: [], community: { rank: 1, participants: 10, top_percent: 10 }, streak: { current_days: 1, active_dates: [] }, event_breakdown: [], generated_at: '2026-09-08T16:00:00.000Z' } }))
    await page.route('**/reputation/me', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, reputation_score: 60, level: 'activista', event_counts: {}, badges_count: 0, total_votes: 2, total_proposals: 1, total_reports: 3, last_activity_at: null, calculated_at: '2026-09-08T16:00:00.000Z' } }))
    await page.route(`**/community/profiles/${citizenId}`, (route) => route.fulfill({ status: 200, json: { public_profile: true, follower_count: 9, actions_count: 4, verified_actions: 3, evidence_count: 11, average_action_score: 78 } }))

    await page.goto('/dashboard/reputation')
    await expect(page.getByTestId('reputation-impact-bridge')).toContainText('Impacto comprobable ≠ actividad acumulada')
    await expect(page.getByTestId('reputation-impact-bridge')).toContainText('78/100')
    await expect(page.getByTestId('reputation-impact-bridge')).toContainText('3/4')
  })

  test('AI copilot uses active territory and forwards neighborhood context', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
    const capturedBody: Record<string, unknown> = {}
    await page.route('**/ai/query', async (route) => {
      Object.assign(capturedBody, route.request().postDataJSON() as Record<string, unknown>)
      await route.fulfill({ status: 200, json: { response: 'Análisis territorial listo.', intent: 'territorial', agent_used: 'territorial', confidence: 0.9, audit_id: 'audit-phase6b', session_id: 'session-phase6b' } })
    })

    await page.goto('/dashboard/ai?topic=territorial&prompt=Analiza%20mi%20barrio')
    await expect(page.getByTestId('contextual-civic-ai')).toContainText('Manga')
    await page.getByLabel('Enviar consulta').click()
    await expect(page.getByText('Análisis territorial listo.')).toBeVisible()
    expect(capturedBody.neighborhood).toBe('Manga')
    expect(capturedBody.topic).toBe('territorial')
  })

  test('workflow triage exposes search and next action', async ({ page }) => {
    await setupShell(page)
    await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
    await page.route('**/workflows/cases?limit=25', (route) => route.fulfill({ status: 200, json: caseResponse }))

    await page.goto('/dashboard/workflows')
    await expect(page.getByTestId('workflow-triage-board')).toBeVisible()
    await expect(page.getByTestId('workflow-triage-board')).toContainText('Iluminación parque Manga')
    await expect(page.getByTestId('workflow-triage-board')).toContainText('Convertir análisis en una propuesta o actuación')
  })
})

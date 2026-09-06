import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:4000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const ACTION_ID = '550e8400-e29b-41d4-a716-446655440020'

async function setupAuth(page: Page) {
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' }])
  await page.addInitScript((citizenId) => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', citizenId)
  }, CITIZEN_ID)
}

const ACTION = {
  id: ACTION_ID,
  actor: {
    id: CITIZEN_ID,
    display_name: 'Liderazgo Manga',
    neighborhood: 'Manga',
    actor_kind: 'social_leader',
    organization: 'Colectivo Manga',
  },
  title: 'Recuperar iluminación del parque',
  problem: 'El parque permanece sin iluminación suficiente y la comunidad ha documentado riesgos durante la noche.',
  objective: 'Restablecer iluminación funcional y dejar evidencia verificable del resultado.',
  category: 'Infraestructura',
  neighborhood: 'Manga',
  locality_id: 1,
  beneficiaries_estimate: 120,
  status: 'in_progress',
  result_summary: null,
  target_date: '2026-10-15',
  started_at: '2026-09-05T12:00:00.000Z',
  completed_at: null,
  created_at: '2026-09-04T12:00:00.000Z',
  updated_at: '2026-09-06T12:00:00.000Z',
  evidence_count: 2,
  external_evidence_count: 0,
  collaborators_count: 2,
  community_validation: { corroborations: 3, disputes: 0, total: 3 },
  score_version: 'civic-reputation-v1',
  civic_score: 67,
  score_dimensions: {
    evidence: 12,
    results: 7,
    impact: 11,
    fulfillment: 6,
    validation: 6,
    continuity: 2,
    transparency: 5,
    collaboration: 2,
  },
  score_explanation: [
    { dimension: 'evidence', label: 'Evidencia', points: 12, max_points: 25 },
    { dimension: 'results', label: 'Resultados', points: 7, max_points: 20 },
    { dimension: 'impact', label: 'Impacto comunitario', points: 11, max_points: 15 },
    { dimension: 'fulfillment', label: 'Cumplimiento', points: 6, max_points: 15 },
    { dimension: 'validation', label: 'Validación ciudadana', points: 6, max_points: 10 },
    { dimension: 'continuity', label: 'Continuidad', points: 2, max_points: 5 },
    { dimension: 'transparency', label: 'Transparencia', points: 5, max_points: 5 },
    { dimension: 'collaboration', label: 'Colaboración', points: 2, max_points: 5 },
  ],
  confidence_score: 58,
  confidence_level: 'medium',
  evidence_level: 2,
}

test.describe('Civic actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.route(`${API}/civic-actions/mine*`, (route) => route.fulfill({ status: 200, json: { data: [ACTION], count: 1 } }))
    await page.route(`${API}/civic-actions/leaderboard*`, (route) => route.fulfill({ status: 200, json: { data: [], count: 0 } }))
  })

  test('renders actions with reputation and confidence as separate signals', async ({ page }) => {
    await page.goto('/dashboard/community/actions')

    await expect(page.getByRole('heading', { name: /acciones cívicas con evidencia/i })).toBeVisible()
    await expect(page.getByText('Recuperar iluminación del parque')).toBeVisible()
    await expect(page.getByText('67')).toBeVisible()
    await expect(page.getByText(/conf\. media · 58/i)).toBeVisible()
    await expect(page.getByText(/seguidores, likes e impresiones no suman reputación/i)).toBeVisible()
  })

  test('creates an action from a problem and objective', async ({ page }) => {
    await page.route(`${API}/civic-actions`, async (route) => {
      expect(route.request().method()).toBe('POST')
      const body = await route.request().postDataJSON()
      expect(body.title).toBe('Recuperar iluminación del parque')
      expect(body.objective).toContain('Restablecer')
      await route.fulfill({ status: 201, json: { id: ACTION_ID } })
    })
    await page.route(`${API}/civic-actions/${ACTION_ID}`, (route) => route.fulfill({ status: 200, json: ACTION }))
    await page.route(`${API}/civic-actions/${ACTION_ID}/evidence`, (route) => route.fulfill({ status: 200, json: { data: [] } }))

    await page.goto('/dashboard/community/actions/new')
    await page.getByLabel('Título de la acción').fill('Recuperar iluminación del parque')
    await page.getByLabel('Problema que quieres resolver').fill('El parque permanece sin iluminación suficiente y la comunidad reporta riesgos durante la noche.')
    await page.getByLabel('Objetivo verificable').fill('Restablecer la iluminación y documentar el resultado con evidencia verificable.')
    await page.getByLabel('Barrio o territorio').fill('Manga')
    await page.getByRole('button', { name: 'Registrar acción' }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/community/actions/${ACTION_ID}$`))
    await expect(page.getByRole('heading', { name: 'Recuperar iluminación del parque' })).toBeVisible()
  })

  test('shows the explainable score and evidence ledger in the action workspace', async ({ page }) => {
    await page.route(`${API}/civic-actions/${ACTION_ID}`, (route) => route.fulfill({ status: 200, json: ACTION }))
    await page.route(`${API}/civic-actions/${ACTION_ID}/evidence`, (route) => route.fulfill({
      status: 200,
      json: {
        data: [{
          id: '550e8400-e29b-41d4-a716-446655440030',
          evidence_type: 'photo',
          evidence_url: 'https://example.com/evidence.jpg',
          description: 'Registro fotográfico de luminarias intervenidas',
          source_url: null,
          content_hash: null,
          review_status: 'pending',
          created_at: '2026-09-06T12:00:00.000Z',
        }],
      },
    }))

    await page.goto(`/dashboard/community/actions/${ACTION_ID}`)
    await expect(page.getByText(/score explicable · civic-reputation-v1/i)).toBeVisible()
    await expect(page.getByText('Evidencia', { exact: true })).toBeVisible()
    await expect(page.getByText(/la confianza \(58\/100\) no se suma al score/i)).toBeVisible()
    await expect(page.getByText('Registro fotográfico de luminarias intervenidas')).toBeVisible()
  })
})

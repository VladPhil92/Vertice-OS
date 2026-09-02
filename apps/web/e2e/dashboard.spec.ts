/**
 * Dashboard home page E2E tests.
 * Verifies live stats load and the institutional citizen actions render.
 */
import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:4000'

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

test.describe('Dashboard home', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)

    await page.route(`${API}/territorial/stats`, (route) =>
      route.fulfill({
        status: 200,
        json: { total_reports: 87, open_reports: 34, by_category: [] },
      }),
    )
    await page.route(`${API}/governance/proposals/stats`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          total_proposals: 23,
          by_status: [],
          by_category: [],
          active_votes: 3,
          total_votes_cast: 150,
        },
      }),
    )
    await page.route(`${API}/reputation/me`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          reputation_score: 1250,
          level: 'activista',
          total_votes: 5,
          total_proposals: 2,
          total_reports: 3,
          badges_count: 1,
          event_counts: {},
          last_activity_at: null,
          calculated_at: new Date().toISOString(),
        },
      }),
    )
    await page.route(`${API}/territorial/reports*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
    await page.route(`${API}/governance/proposals*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
  })

  test('shows the Cartagena citizen dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /cartagena la construimos juntos/i })).toBeVisible()
    await expect(page.getByAltText(/vértice — inteligencia ciudadana/i).first()).toBeVisible()
  })

  test('loads and displays live stats', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByText('23')).toBeVisible()
    await expect(page.getByText('34')).toBeVisible()
    await expect(page.getByText('1.3k')).toBeVisible()
  })

  test('shows the citizen quick actions from the visual system', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: /reportar un caso/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /votar y participar/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /generar propuesta/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /debatir con ia/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /ver mapa de la ciudad/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /control público/i })).toBeVisible()
  })

  test('still renders when stats API fails', async ({ page }) => {
    await page.route(`${API}/territorial/stats`, (route) =>
      route.fulfill({ status: 500, json: {} }),
    )
    await page.route(`${API}/governance/proposals/stats`, (route) =>
      route.fulfill({ status: 500, json: {} }),
    )

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /cartagena la construimos juntos/i })).toBeVisible()
    await expect(page.getByText('0').first()).toBeVisible()
  })
})

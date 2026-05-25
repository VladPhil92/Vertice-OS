/**
 * Dashboard home page E2E tests.
 * Verifies live stats load and quick-action cards render.
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
    // Also mock recent-activity endpoints used by dashboard
    await page.route(`${API}/territorial/reports*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
    await page.route(`${API}/governance/proposals*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
  })

  test('shows dashboard heading', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /vértice os/i })).toBeVisible()
  })

  test('loads and displays live stats', async ({ page }) => {
    await page.goto('/dashboard')

    // Wait for loading spinners to disappear
    await expect(page.locator('.animate-spin').first()).not.toBeVisible({ timeout: 5000 })

    await expect(page.getByText('23')).toBeVisible()  // proposals
    await expect(page.getByText('34')).toBeVisible()  // open reports
    await expect(page.getByText('1.3k')).toBeVisible() // reputation formatted
  })

  test('shows all 4 quick-action cards', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: /nueva propuesta/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /reportar problema/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /consultar ia/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /doc\. legal/i })).toBeVisible()
  })

  test('still renders when stats API fails', async ({ page }) => {
    // Override with failures
    await page.route(`${API}/territorial/stats`, (route) =>
      route.fulfill({ status: 500, json: {} }),
    )
    await page.route(`${API}/governance/proposals/stats`, (route) =>
      route.fulfill({ status: 500, json: {} }),
    )

    await page.goto('/dashboard')
    // Page should still render the heading despite failed stats
    await expect(page.getByRole('heading', { name: /vértice os/i })).toBeVisible()
    // Stats show 0 as fallback
    await expect(page.getByText('0').first()).toBeVisible()
  })
})

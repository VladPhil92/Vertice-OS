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

async function mockRole(page: Page, activeRole: 'citizen' | 'moderator' | 'admin' | 'superadmin') {
  await page.route(`${API}/auth/roles`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        assigned_roles: activeRole === 'citizen' ? ['citizen'] : ['citizen', activeRole],
        active_role: activeRole,
      },
    }),
  )
}

test.describe('Role capability convergence', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.route(`${API}/territorial/admin/reports*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
    await page.route(`${API}/governance/admin/proposals*`, (route) =>
      route.fulfill({ status: 200, json: { data: [], count: 0 } }),
    )
  })

  test('superadmin inherits moderation capability from the live role context', async ({ page }) => {
    await mockRole(page, 'superadmin')

    await page.goto('/dashboard/admin')

    await expect(page.getByRole('heading', { name: /panel de moderación/i })).toBeVisible()
    await expect(page.getByText('Superadmin', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /moderación/i })).toBeVisible()
  })

  test('citizen remains excluded from the moderation surface', async ({ page }) => {
    await mockRole(page, 'citizen')

    await page.goto('/dashboard/admin')

    await expect(page.getByText(/acceso restringido a moderadores/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /panel de moderación/i })).toHaveCount(0)
  })
})

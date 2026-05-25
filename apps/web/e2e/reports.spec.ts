/**
 * Reports module E2E tests.
 * Covers list view, filtering, and creating a new report.
 */
import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:4000'

const MOCK_REPORTS = [
  {
    id: 'report-001',
    category: 'infraestructura',
    title: 'Hueco peligroso en Avenida Pedro de Heredia',
    description: 'Hueco grande que daña los vehículos y representa un riesgo para motociclistas.',
    neighborhood: 'El Bosque',
    status: 'open',
    urgency_score: 0.8,
    created_at: '2025-05-01T10:00:00Z',
  },
  {
    id: 'report-002',
    category: 'servicios_publicos',
    title: 'Fuga de agua en calle 30',
    description: 'Lleva tres días con fuga de agua potable en la vía pública.',
    neighborhood: 'Manga',
    status: 'in_progress',
    urgency_score: 0.6,
    created_at: '2025-05-03T14:30:00Z',
  },
]

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  // localStorage is set after DOMContentLoaded
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

// ─── Reports list ─────────────────────────────────────────────────────────────

test.describe('Reports list', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.route(`${API}/territorial/reports`, (route) =>
      route.fulfill({ status: 200, json: { reports: MOCK_REPORTS } }),
    )
  })

  test('shows list of reports', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await expect(page.getByText('Hueco peligroso en Avenida Pedro de Heredia')).toBeVisible()
    await expect(page.getByText('Fuga de agua en calle 30')).toBeVisible()
  })

  test('shows result count', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await expect(page.getByText(/2 resultado/)).toBeVisible()
  })

  test('filters by category', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await page.getByLabel(/categoría/i).selectOption('servicios_publicos')
    await expect(page.getByText('Fuga de agua en calle 30')).toBeVisible()
    await expect(page.getByText('Hueco peligroso')).not.toBeVisible()
  })

  test('filters by status', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await page.getByLabel(/estado/i).selectOption('open')
    await expect(page.getByText('Hueco peligroso en Avenida Pedro de Heredia')).toBeVisible()
    await expect(page.getByText('Fuga de agua en calle 30')).not.toBeVisible()
  })

  test('shows empty state when no results match filter', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await page.getByLabel(/estado/i).selectOption('resolved')
    await expect(page.getByText(/no hay reportes/i)).toBeVisible()
  })

  test('shows error state when API fails', async ({ page }) => {
    await page.route(`${API}/territorial/reports`, (route) =>
      route.fulfill({ status: 500, json: { error: 'Internal error' } }),
    )
    await page.goto('/dashboard/reports')
    await expect(page.getByText(/no se pudieron cargar/i)).toBeVisible()
  })

  test('links to create new report', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await expect(page.getByRole('link', { name: /nuevo reporte/i })).toBeVisible()
  })
})

// ─── Create report ────────────────────────────────────────────────────────────

test.describe('Create report', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
  })

  test('renders form fields', async ({ page }) => {
    await page.goto('/dashboard/reports/new')
    await expect(page.getByLabel(/categoría/i)).toBeVisible()
    await expect(page.getByLabel(/título/i)).toBeVisible()
    await expect(page.getByLabel(/descripción/i)).toBeVisible()
  })

  test('shows character counter for description', async ({ page }) => {
    await page.goto('/dashboard/reports/new')
    const desc = page.getByLabel(/descripción/i)
    await desc.fill('Test descripción corta')
    await expect(page.getByText(/22\s*\/\s*5000/)).toBeVisible()
  })

  test('submits form and redirects to reports list', async ({ page }) => {
    await page.route(`${API}/territorial/reports`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: { id: 'new-report-uuid', ...MOCK_REPORTS[0] },
        })
      }
      return route.fulfill({ status: 200, json: { reports: [] } })
    })

    await page.goto('/dashboard/reports/new')

    await page.getByLabel(/categoría/i).selectOption('infraestructura')
    await page.getByLabel(/título/i).fill('Calle en mal estado cerca del mercado')
    await page.getByLabel(/descripción/i).fill(
      'La calle presenta múltiples huecos y acumulación de basura que generan riesgo para los peatones y conductores del sector.',
    )

    await page.getByRole('button', { name: /publicar reporte/i }).click()
    await expect(page).toHaveURL('/dashboard/reports')
  })

  test('shows error when API rejects submission', async ({ page }) => {
    await page.route(`${API}/territorial/reports`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 400, json: { message: 'Descripción muy corta' } })
      }
      return route.fulfill({ status: 200, json: { reports: [] } })
    })

    await page.goto('/dashboard/reports/new')
    await page.getByLabel(/categoría/i).selectOption('seguridad')
    await page.getByLabel(/título/i).fill('Inseguridad en el parque')
    await page.getByLabel(/descripción/i).fill('Descripción de prueba para el test del formulario de reporte ciudadano.')

    await page.getByRole('button', { name: /publicar reporte/i }).click()
    await expect(page.getByText(/descripción muy corta/i)).toBeVisible()
  })
})

/**
 * Proposals module E2E tests.
 * Covers list, endorsement, and proposal creation.
 */
import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:4000'

const MOCK_PROPOSALS = [
  {
    id: 'prop-001',
    title: 'Ciclovía permanente en el Centro Histórico',
    category: 'movilidad',
    scope: 'locality',
    status: 'debate',
    executive_summary: 'Implementar ciclovía de 5km en el Centro Histórico para reducir congestión.',
    description: 'Propuesta detallada para crear infraestructura de movilidad sostenible.',
    endorsement_count: 143,
    comment_count: 28,
    created_at: '2025-04-20T09:00:00Z',
  },
  {
    id: 'prop-002',
    title: 'Cámaras de seguridad en Olaya Herrera',
    category: 'seguridad',
    scope: 'neighborhood',
    status: 'idea',
    executive_summary: null,
    description: 'Instalar 20 cámaras de videovigilancia en puntos críticos del barrio.',
    endorsement_count: 37,
    comment_count: 5,
    created_at: '2025-05-10T11:00:00Z',
  },
]

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

// ─── Proposals list ───────────────────────────────────────────────────────────

test.describe('Proposals list', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.route(`${API}/governance/proposals*`, (route) =>
      route.fulfill({ status: 200, json: { data: MOCK_PROPOSALS, count: 2 } }),
    )
  })

  test('shows list of proposals', async ({ page }) => {
    await page.goto('/dashboard/proposals')
    await expect(page.getByText('Ciclovía permanente en el Centro Histórico')).toBeVisible()
    await expect(page.getByText('Cámaras de seguridad en Olaya Herrera')).toBeVisible()
  })

  test('shows endorsement counts', async ({ page }) => {
    await page.goto('/dashboard/proposals')
    await expect(page.getByText('143')).toBeVisible()
    await expect(page.getByText('37')).toBeVisible()
  })

  test('endorses a proposal optimistically', async ({ page }) => {
    await page.route(`${API}/governance/proposals/prop-001/endorse`, (route) =>
      route.fulfill({ status: 200, json: { success: true } }),
    )

    await page.goto('/dashboard/proposals')
    // Find and click the endorse button for the first proposal
    const endorseBtn = page.getByRole('button', { name: /apoyar/i }).first()
    await endorseBtn.click()

    // Optimistic update: count should increase immediately
    await expect(page.getByText('144')).toBeVisible()
  })

  test('rolls back endorsement on API error', async ({ page }) => {
    await page.route(`${API}/governance/proposals/prop-001/endorse`, (route) =>
      route.fulfill({ status: 500, json: { error: 'Error interno' } }),
    )

    await page.goto('/dashboard/proposals')
    const endorseBtn = page.getByRole('button', { name: /apoyar/i }).first()
    await endorseBtn.click()

    // Should roll back to original count after failure
    await expect(page.getByText('143')).toBeVisible()
    await expect(page.getByText('144')).not.toBeVisible()
  })

  test('filters by status', async ({ page }) => {
    await page.goto('/dashboard/proposals')
    const statusSelect = page.locator('select').first()
    await statusSelect.selectOption('debate')
    await expect(page.getByText('Ciclovía permanente')).toBeVisible()
    await expect(page.getByText('Cámaras de seguridad')).not.toBeVisible()
  })
})

// ─── Create proposal ──────────────────────────────────────────────────────────

test.describe('Create proposal', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
  })

  test('renders all form fields', async ({ page }) => {
    await page.goto('/dashboard/proposals/new')
    await expect(page.getByLabel(/título/i)).toBeVisible()
    await expect(page.getByLabel(/categoría/i)).toBeVisible()
    await expect(page.getByLabel(/alcance/i)).toBeVisible()
    await expect(page.getByLabel(/descripción/i)).toBeVisible()
  })

  test('shows description character count', async ({ page }) => {
    await page.goto('/dashboard/proposals/new')
    const desc = page.getByLabel(/descripción/i)
    await desc.fill('Esta es mi propuesta ciudadana para mejorar Cartagena.')
    await expect(page.getByText(/53/)).toBeVisible()
  })

  test('validates minimum description length', async ({ page }) => {
    await page.goto('/dashboard/proposals/new')
    await page.getByLabel(/título/i).fill('Mi propuesta')
    await page.getByLabel(/categoría/i).selectOption('infraestructura')
    await page.getByLabel(/alcance/i).selectOption('city')
    await page.getByLabel(/descripción/i).fill('Corta')

    await page.getByRole('button', { name: /publicar propuesta/i }).click()

    await expect(page.getByText(/al menos 50 caracteres/i)).toBeVisible()
  })

  test('submits proposal and redirects', async ({ page }) => {
    await page.route(`${API}/governance/proposals`, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          json: { id: 'new-prop-uuid', title: 'Mi nueva propuesta' },
        })
      }
      return route.fulfill({ status: 200, json: { data: [], count: 0 } })
    })

    await page.goto('/dashboard/proposals/new')
    await page.getByLabel(/título/i).fill('Parques biosaludables para adultos mayores en Cartagena')
    await page.getByLabel(/categoría/i).selectOption('salud')
    await page.getByLabel(/alcance/i).selectOption('city')
    await page.getByLabel(/descripción/i).fill(
      'Propuesta para instalar equipos de ejercicio biosaludable en los 12 parques principales ' +
      'de Cartagena, beneficiando especialmente a la población adulta mayor de todos los barrios.',
    )

    await page.getByRole('button', { name: /publicar propuesta/i }).click()
    await expect(page).toHaveURL('/dashboard/proposals')
  })
})

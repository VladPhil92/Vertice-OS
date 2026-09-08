import { test, expect, type Page } from '@playwright/test'

const citizenId = '550e8400-e29b-41d4-a716-446655440000'
const publicationId = '44444444-4444-4444-8444-444444444444'

async function setupShell(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'phase7-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
  await page.route('**/auth/roles', (route) => route.fulfill({ status: 200, json: { assigned_roles: ['citizen'], active_role: 'citizen' } }))
  await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, avatar_url: null, status: 'missing', upload_enabled: false } }))
  await page.route('**/community/profile/me', (route) => route.fulfill({
    status: 200,
    json: { citizen_id: citizenId, display_name: 'Lideresa Manga', neighborhood: 'Manga', profile_type: 'social_leader', bio: 'Gestión verificable', organization: null, public_profile: true, reputation_score: 60 },
  }))
}

const proAccess = {
  plan: {
    code: 'pro',
    name: 'Vértice Pro',
    limits: { evidenceStorageMb: 5000, aiRequestsPerMonth: 500, scheduledPostsPerMonth: 100 },
  },
  subscription: { id: 'sub-1', status: 'active' },
}

const usage = {
  planCode: 'pro',
  metrics: {
    ai_requests: { metric: 'ai_requests', used: 14, limit: 500, remaining: 486, percent: 3, periodStart: '2026-09-01' },
    evidence_storage_bytes: { metric: 'evidence_storage_bytes', used: 0, limit: 5242880000, remaining: 5242880000, percent: 0, periodStart: '2026-09-01' },
    scheduled_posts: { metric: 'scheduled_posts', used: 2, limit: 100, remaining: 98, percent: 2, periodStart: '2026-09-01' },
  },
  generatedAt: '2026-09-08T18:00:00.000Z',
}

test.describe('Dashboard operational capacity Phase 7', () => {
  test('shows durable plan consumption and Pro operations', async ({ page }) => {
    await setupShell(page)
    await page.route('**/billing/me', (route) => route.fulfill({ status: 200, json: proAccess }))
    await page.route('**/billing/usage', (route) => route.fulfill({ status: 200, json: usage }))
    await page.route('**/publishing/scheduled', (route) => route.fulfill({ status: 200, json: { publications: [], count: 0 } }))

    await page.goto('/dashboard/operations')

    await expect(page.getByTestId('operational-capacity-center')).toBeVisible()
    await expect(page.getByText('14 / 500')).toBeVisible()
    await expect(page.getByText('2 / 100')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Programar actualización cívica' })).toBeVisible()
    await expect(page.getByText(/no suma reputación/i)).toBeVisible()
  })

  test('creates a scheduled civic publication and refreshes quota state', async ({ page }) => {
    await setupShell(page)
    let publications: Array<Record<string, unknown>> = []
    let scheduledUsage = 2

    await page.route('**/billing/me', (route) => route.fulfill({ status: 200, json: proAccess }))
    await page.route('**/billing/usage', (route) => route.fulfill({
      status: 200,
      json: {
        ...usage,
        metrics: {
          ...usage.metrics,
          scheduled_posts: { ...usage.metrics.scheduled_posts, used: scheduledUsage, remaining: 100 - scheduledUsage },
        },
      },
    }))
    await page.route('**/publishing/scheduled', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { title: string; body: string; scheduled_for: string; neighborhood: string | null }
        scheduledUsage += 1
        const publication = {
          id: publicationId,
          ...body,
          status: 'scheduled',
          published_at: null,
          created_at: '2026-09-08T18:00:00.000Z',
        }
        publications = [publication]
        await route.fulfill({ status: 201, json: publication })
        return
      }
      await route.fulfill({ status: 200, json: { publications, count: publications.length } })
    })

    await page.goto('/dashboard/operations')
    await page.getByPlaceholder('Título').fill('Avance comunitario de Manga')
    await page.getByPlaceholder('Actualización, contexto o avance verificable…').fill('Se completó la primera jornada de recuperación y documentamos los siguientes compromisos del equipo.')
    await page.getByPlaceholder('Barrio (opcional)').fill('Manga')
    await page.locator('input[type="datetime-local"]').fill('2026-09-10T10:00')
    await page.getByRole('button', { name: 'Programar publicación' }).click()

    await expect(page.getByText('Avance comunitario de Manga')).toBeVisible()
    await expect(page.getByText(/Programada para/)).toBeVisible()
  })
})

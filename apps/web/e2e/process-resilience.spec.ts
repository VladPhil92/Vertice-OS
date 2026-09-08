import { expect, test, type Page } from '@playwright/test'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

const PROFILE = {
  citizen_id: CITIZEN_ID,
  display_name: 'Ciudadana Resiliencia',
  neighborhood: 'Manga',
  profile_type: 'citizen',
  bio: null,
  organization: null,
  public_profile: true,
  reputation_score: 42,
}

const MISSING_AVATAR = {
  citizen_id: CITIZEN_ID,
  avatar_url: null,
  status: 'missing',
  updated_at: null,
  upload_enabled: true,
}

async function setupAuth(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(({ citizenId }) => {
    localStorage.setItem('access_token', 'process-resilience-test-token')
    localStorage.setItem('citizen_id', citizenId)
  }, { citizenId: CITIZEN_ID })
}

async function setupShellRoutes(page: Page) {
  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen'], active_role: 'citizen' },
  }))
  await page.route('**/notifications', (route) => route.fulfill({
    status: 200,
    json: { notifications: [], unread: 0 },
  }))
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({
    status: 200,
    json: { total: 0, items: [] },
  }))
  await page.route('**/dashboard/me', (route) => route.fulfill({
    status: 200,
    json: {
      profile: {
        id: CITIZEN_ID,
        email: 'citizen@example.com',
        neighborhood: 'Manga',
        locality_id: 1,
        verification_level: 1,
        created_at: '2026-09-01T10:00:00.000Z',
      },
      reputation: {
        score: 42,
        level: 'activo',
        total_votes: 0,
        total_proposals: 0,
        total_reports: 0,
        badges_count: 0,
        endorsements_given: 0,
      },
      attention: {
        verification_required: false,
        pending_votes: [],
        legal_needs_action: 0,
        reports_in_progress: 0,
        civic_actions_needing_evidence: 0,
        total_items: 0,
      },
      mine: {
        civic_actions: { total: 0, active: 0, verified: 0, needs_evidence: 0, awaiting_verification: 0, recent: [] },
        reports: { total: 0, by_status: {}, recent: [] },
        proposals: { total: 0, by_status: {}, recent: [] },
        legal: { total: 0, by_status: {}, recent: [] },
        workflows: { total: 0, active: 0, recent: [] },
      },
      city: {
        reports: { total_reports: 0, open_reports: 0, by_category: [] },
        governance: { total_proposals: 0, by_status: [] },
      },
      generated_at: '2026-09-08T04:30:00.000Z',
    },
  }))
  await page.route('**/events?**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: '',
  }))
}

async function fillProposal(page: Page) {
  await page.getByLabel(/título/i).fill('Corredor peatonal seguro en Manga')
  await page.getByLabel(/categoría/i).selectOption('movilidad')
  await page.getByLabel(/alcance/i).selectOption('neighborhood')
  await page.getByLabel(/descripción completa/i).fill(
    'Crear un corredor peatonal señalizado y verificable que reduzca conflictos entre peatones y vehículos en las horas de mayor flujo del barrio.',
  )
}

test.describe('Phase 5 — cross-module process resilience', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await setupShellRoutes(page)
  })

  test('retries one transient read failure and recovers the civic profile', async ({ page }) => {
    let profileCalls = 0

    await page.route('**/community/profile/me', (route) => {
      profileCalls += 1
      if (profileCalls === 1) {
        return route.fulfill({ status: 503, json: { error: 'temporary upstream outage' } })
      }
      return route.fulfill({ status: 200, json: PROFILE })
    })
    await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
      status: 200,
      json: MISSING_AVATAR,
    }))

    await page.goto('/dashboard/community/profile')

    await expect(page.getByRole('heading', { name: /configura cómo apareces en la red cívica/i })).toBeVisible()
    await expect(page.getByRole('main').getByLabel('Foto de perfil de Ciudadana Resiliencia')).toBeVisible()
    expect(profileCalls).toBe(2)
  })

  test('coalesces concurrent equivalent proposal mutations into one backend write', async ({ page }) => {
    let mutationCalls = 0

    await page.route('**/governance/proposals', async (route) => {
      mutationCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 250))
      await route.fulfill({ status: 201, json: { id: 'proposal-resilience-1' } })
    })

    await page.goto('/dashboard/proposals/new')
    await fillProposal(page)

    await page.locator('form').evaluate((form) => {
      const htmlForm = form as HTMLFormElement
      htmlForm.requestSubmit()
      htmlForm.requestSubmit()
    })

    await expect.poll(() => mutationCalls).toBe(1)
    await expect(page).toHaveURL(/\/dashboard\/proposals$/)
  })

  test('never retries a failed mutation automatically and preserves the form for recovery', async ({ page }) => {
    let mutationCalls = 0

    await page.route('**/governance/proposals', (route) => {
      mutationCalls += 1
      return route.fulfill({ status: 503, json: {} })
    })

    await page.goto('/dashboard/proposals/new')
    await fillProposal(page)
    await page.getByRole('button', { name: /publicar propuesta/i }).click()

    await expect(page.getByText(/servicio no está disponible temporalmente/i)).toBeVisible()
    await expect(page.getByLabel(/título/i)).toHaveValue('Corredor peatonal seguro en Manga')
    expect(mutationCalls).toBe(1)
  })

  test('turns malformed success responses into a controlled process error instead of crashing the page', async ({ page }) => {
    await page.route('**/governance/proposals', (route) => route.fulfill({
      status: 201,
      contentType: 'text/html',
      body: '<html>unexpected proxy response</html>',
    }))

    await page.goto('/dashboard/proposals/new')
    await fillProposal(page)
    await page.getByRole('button', { name: /publicar propuesta/i }).click()

    await expect(page.getByText(/respuesta inválida/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /nueva propuesta ciudadana/i })).toBeVisible()
  })

  test('ends an expired session deterministically instead of leaving callers pending', async ({ page }) => {
    await page.route('**/community/profile/me', (route) => route.fulfill({
      status: 401,
      json: { error: 'expired' },
    }))
    await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
      status: 401,
      json: { error: 'expired' },
    }))
    await page.route('**/auth/refresh', (route) => route.fulfill({
      status: 401,
      json: { error: 'refresh expired' },
    }))

    await page.goto('/dashboard/community/profile')

    await expect(page).toHaveURL(/\/auth\/login\?next=/)
  })
})

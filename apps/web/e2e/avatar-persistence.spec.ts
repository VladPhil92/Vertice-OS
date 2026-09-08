import { expect, test, type Page } from '@playwright/test'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const DELIVERY_URL = 'https://imagedelivery.net/vertice-test/avatar-1/public'
const UPLOAD_URL = 'https://upload.imagedelivery.net/vertice-test-direct-upload'

const PROFILE = {
  citizen_id: CITIZEN_ID,
  display_name: 'Ciudadana Test',
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

const APPROVED_AVATAR = {
  citizen_id: CITIZEN_ID,
  avatar_url: DELIVERY_URL,
  status: 'approved',
  updated_at: '2026-09-08T04:00:00.000Z',
  upload_enabled: true,
}

const PORTRAIT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAoAAAAKACAIAAACDr150AAAH5klEQVR42u3VMREAAAjEMMC/58cFA5dI6NJOUgDArZEAAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYAkAwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAA+Wj7YB/22A1mLAAAAAElFTkSuQmCC',
  'base64',
)

async function setupAuth(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(({ citizenId }) => {
    localStorage.setItem('access_token', 'test-access-token')
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
  await page.route('**/dashboard/me/resolution', (route) => route.fulfill({ status: 200, json: { total: 0, items: [] } }))
  await page.route('**/dashboard/me', (route) => route.fulfill({ status: 200, json: {
    profile: { id: CITIZEN_ID, email: 'citizen@example.com', neighborhood: 'Manga', locality_id: 1, verification_level: 1, created_at: '2026-09-01T10:00:00.000Z' },
    reputation: { score: 42, level: 'activo', total_votes: 0, total_proposals: 0, total_reports: 0, badges_count: 0, endorsements_given: 0 },
    attention: { verification_required: false, pending_votes: [], legal_needs_action: 0, reports_in_progress: 0, civic_actions_needing_evidence: 0, total_items: 0 },
    mine: { civic_actions: { total: 0, active: 0, verified: 0, needs_evidence: 0, awaiting_verification: 0, recent: [] }, reports: { total: 0, by_status: {}, recent: [] }, proposals: { total: 0, by_status: {}, recent: [] }, legal: { total: 0, by_status: {}, recent: [] }, workflows: { total: 0, active: 0, recent: [] } },
    city: { reports: { total_reports: 0, open_reports: 0, by_category: [] }, governance: { total_proposals: 0, by_status: [] } },
    generated_at: '2026-09-08T04:00:00.000Z',
  } }))
  await page.route('**/events?**', (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }))
}

test.describe('Civic avatar persistence HTTP contract', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await setupShellRoutes(page)
  })

  test('uploads, confirms and restores the avatar after a hard refresh', async ({ page }) => {
    let persisted = false
    let uploadIntentContentType: string | undefined
    let uploadIntentBody: string | null = null

    await page.route('**/community/profile/me', (route) => route.fulfill({ status: 200, json: PROFILE }))
    await page.route('**/community/profile/me/avatar', (route) => route.fulfill({
      status: 200,
      json: persisted ? APPROVED_AVATAR : MISSING_AVATAR,
    }))
    await page.route('**/community/profile/me/avatar/upload-intent', (route) => {
      uploadIntentContentType = route.request().headers()['content-type']
      uploadIntentBody = route.request().postData()
      return route.fulfill({ status: 200, json: { asset_id: 'avatar-1', upload_url: UPLOAD_URL } })
    })
    await page.route(UPLOAD_URL, (route) => route.fulfill({ status: 200, json: { success: true } }))
    await page.route('**/community/profile/me/avatar/confirm', (route) => {
      persisted = true
      return route.fulfill({ status: 200, json: APPROVED_AVATAR })
    })
    await page.route('https://imagedelivery.net/**', (route) => route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PORTRAIT_PNG,
    }))

    await page.goto('/dashboard/community/profile')
    await expect(page.getByRole('heading', { name: /configura cómo apareces en la red cívica/i })).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({
      name: 'portrait.png',
      mimeType: 'image/png',
      buffer: PORTRAIT_PNG,
    })
    await expect(page.getByText(/foto lista: resolución validada/i)).toBeVisible()
    await page.locator('input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /usar esta foto/i }).click()

    await expect(page.getByText(/foto de perfil actualizada y lista/i)).toBeVisible()
    expect(uploadIntentContentType).toBeUndefined()
    expect(uploadIntentBody).toBeNull()

    await page.reload()

    const portrait = page.getByRole('main').getByRole('img', { name: 'Foto de perfil de Ciudadana Test' })
    await expect(portrait).toHaveAttribute('src', DELIVERY_URL)
    await expect(page.getByText('Publicada', { exact: true })).toBeVisible()
  })

  test('refresh-token POST is bodyless and does not advertise JSON', async ({ page }) => {
    let profileCalls = 0
    let refreshContentType: string | undefined
    let refreshBody: string | null = 'not-called'

    await page.route('**/community/profile/me', (route) => {
      profileCalls += 1
      if (profileCalls === 1) return route.fulfill({ status: 401, json: { error: 'expired' } })
      return route.fulfill({ status: 200, json: PROFILE })
    })
    await page.route('**/community/profile/me/avatar', (route) => route.fulfill({ status: 200, json: MISSING_AVATAR }))
    await page.route('**/auth/refresh', (route) => {
      refreshContentType = route.request().headers()['content-type']
      refreshBody = route.request().postData()
      return route.fulfill({ status: 200, json: { access_token: 'renewed-access-token' } })
    })

    await page.goto('/dashboard/community/profile')

    await expect(page.getByRole('heading', { name: /configura cómo apareces en la red cívica/i })).toBeVisible()
    await expect.poll(() => profileCalls).toBe(2)
    expect(refreshContentType).toBeUndefined()
    expect(refreshBody).toBeNull()
  })
})

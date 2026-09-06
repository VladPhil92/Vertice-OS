import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:4000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440001'
const REPORT_ID = '550e8400-e29b-41d4-a716-446655440010'

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

const ACTIVITY = {
  id: REPORT_ID,
  type: 'report',
  actor: {
    id: ACTOR_ID,
    display_name: 'Liderazgo Manga',
    neighborhood: 'Manga',
    actor_kind: 'social_leader',
    organization: 'Colectivo Manga',
    public_profile: true,
    platform_reputation_score: 82,
  },
  title: 'Recuperación del parque barrial',
  summary: 'Jornada comunitaria documentada con seguimiento de mantenimiento y fotografías del resultado.',
  category: 'infraestructura',
  status: 'resolved',
  neighborhood: 'Manga',
  evidence_count: 2,
  verification_state: 'verified',
  civic_score: 86,
  score_dimensions: {
    evidence: 20,
    results: 20,
    impact: 12,
    validation: 0,
    transparency: 5,
    collaboration: 0,
    continuity: 5,
    confidence: 14,
  },
  community_validation: { corroborations: 3, disputes: 1, total: 4 },
  created_at: '2026-09-05T12:00:00.000Z',
  updated_at: '2026-09-06T12:00:00.000Z',
  href: `/dashboard/reports/${REPORT_ID}`,
}

test.describe('Community social graph', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
    await page.route(`${API}/community/feed*`, (route) => route.fulfill({ status: 200, json: { data: [ACTIVITY], count: 1 } }))
    await page.route(`${API}/community/leaderboard*`, (route) => route.fulfill({
      status: 200,
      json: {
        data: [{
          citizen_id: ACTOR_ID,
          display_name: 'Liderazgo Manga',
          neighborhood: 'Manga',
          actor_kind: 'social_leader',
          organization: 'Colectivo Manga',
          leader_score: 88,
          platform_reputation_score: 82,
          actions_count: 4,
          verified_actions: 3,
          evidence_count: 8,
          average_action_score: 84,
          verification_rate: 75,
          rank: 1,
        }],
        count: 1,
      },
    }))
    await page.route(`${API}/community/following/feed*`, (route) => route.fulfill({ status: 200, json: { data: [ACTIVITY], count: 1, scope: 'following' } }))
  })

  test('renders public civic actors and following feed', async ({ page }) => {
    await page.goto('/dashboard/community')
    await expect(page.getByRole('heading', { name: /sigue gestión, no popularidad/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Liderazgo Manga' }).first()).toBeVisible()
    await expect(page.getByText('3').first()).toBeVisible()

    await page.getByRole('button', { name: 'Siguiendo' }).click()
    await expect(page.getByText('Recuperación del parque barrial')).toBeVisible()
  })

  test('records a corroboration without changing the civic score', async ({ page }) => {
    await page.route(`${API}/community/activities/report/${REPORT_ID}/validation`, async (route) => {
      expect(route.request().method()).toBe('PUT')
      expect(await route.request().postDataJSON()).toEqual({ stance: 'corroborate', note: null })
      await route.fulfill({
        status: 200,
        json: { corroborations: 4, disputes: 1, total: 5, my_stance: 'corroborate', my_note: null },
      })
    })

    await page.goto('/dashboard/community')
    await page.getByRole('button', { name: /corroborar/i }).click()
    await expect(page.getByText('4').first()).toBeVisible()
    await expect(page.getByText('86')).toBeVisible()
  })

  test('opens a public profile and follows its management', async ({ page }) => {
    await page.route(`${API}/community/profiles/${ACTOR_ID}`, (route) => route.fulfill({
      status: 200,
      json: {
        citizen_id: ACTOR_ID,
        display_name: 'Liderazgo Manga',
        neighborhood: 'Manga',
        profile_type: 'social_leader',
        bio: 'Trabajo comunitario con evidencia y seguimiento.',
        organization: 'Colectivo Manga',
        public_profile: true,
        reputation_score: 82,
        follower_count: 12,
        actions_count: 1,
        verified_actions: 1,
        evidence_count: 2,
        average_action_score: 86,
        recent_actions: [ACTIVITY],
      },
    }))
    await page.route(`${API}/community/profiles/${ACTOR_ID}/follow-state`, (route) => route.fulfill({
      status: 200,
      json: { following: false, follower_count: 12 },
    }))
    await page.route(`${API}/community/profiles/${ACTOR_ID}/follow`, (route) => route.fulfill({
      status: 200,
      json: { following: true, follower_count: 13 },
    }))

    await page.goto(`/dashboard/community/profiles/${ACTOR_ID}`)
    await expect(page.getByRole('heading', { name: 'Liderazgo Manga' })).toBeVisible()
    await page.getByRole('button', { name: 'Seguir gestión' }).click()
    await expect(page.getByRole('button', { name: 'Siguiendo' })).toBeVisible()
    await expect(page.getByText('13 seguidores')).toBeVisible()
  })
})
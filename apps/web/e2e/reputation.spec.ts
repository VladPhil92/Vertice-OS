import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:4000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'

async function setupAuth(page: Page) {
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

async function mockProfileApis(page: Page, analyticsStatus = 200) {
  await page.route(`${API}/reputation/me`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        citizen_id: CITIZEN_ID,
        reputation_score: 75,
        level: 'activista',
        event_counts: {
          vote_cast: 5,
          proposal_created: 2,
          report_submitted: 3,
          endorsement_given: 4,
          badge_earned: 1,
        },
        badges_count: 1,
        total_votes: 5,
        total_proposals: 2,
        total_reports: 3,
        last_activity_at: '2026-09-01T15:00:00.000Z',
        calculated_at: '2026-09-01T15:05:00.000Z',
      },
    }),
  )

  await page.route(`${API}/auth/me`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        id: CITIZEN_ID,
        did: `did:vertice:${CITIZEN_ID}`,
        email: 'ciudadano@example.com',
        neighborhood: 'Crespo',
        locality_id: 1,
        reputation_score: '75',
        verification_level: 2,
        created_at: '2026-05-14T12:00:00.000Z',
        last_active_at: '2026-09-01T15:00:00.000Z',
      },
    }),
  )

  await page.route(`${API}/identity/status`, (route) =>
    route.fulfill({
      status: 200,
      json: {
        citizen_id: CITIZEN_ID,
        did: `did:vertice:${CITIZEN_ID}`,
        level: 2,
        level_name: 'contacto_verificado',
        can_vote: true,
        can_propose: true,
      },
    }),
  )

  await page.route(`${API}/reputation/me/analytics`, (route) => {
    if (analyticsStatus !== 200) {
      return route.fulfill({ status: analyticsStatus, json: { error: 'analytics unavailable' } })
    }
    return route.fulfill({
      status: 200,
      json: {
        citizen_id: CITIZEN_ID,
        score_history: [
          { period: '2026-06', points: 15, cumulative_score: 15 },
          { period: '2026-07', points: 25, cumulative_score: 40 },
          { period: '2026-08', points: 35, cumulative_score: 75 },
        ],
        community: { rank: 12, participants: 150, top_percent: 8 },
        streak: {
          current_days: 4,
          active_dates: ['2026-09-01', '2026-08-31', '2026-08-30', '2026-08-29'],
        },
        event_breakdown: [
          { event_type: 'proposal_created', count: 2, points_per_event: 10, points_total: 20 },
          { event_type: 'report_submitted', count: 3, points_per_event: 8, points_total: 24 },
          { event_type: 'vote_cast', count: 5, points_per_event: 5, points_total: 25 },
          { event_type: 'endorsement_given', count: 4, points_per_event: 2, points_total: 8 },
        ],
        generated_at: '2026-09-01T15:05:00.000Z',
      },
    })
  })
}

test.describe('Civic profile and data visualization', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
  })

  test('renders verified identity and real civic analytics', async ({ page }) => {
    await mockProfileApis(page)
    await page.goto('/dashboard/reputation')

    await expect(page.getByRole('heading', { name: 'Ciudadano VÉRTICE' })).toBeVisible()
    await expect(page.getByText('Crespo, Cartagena')).toBeVisible()
    await expect(page.getByText('Contacto verificado').first()).toBeVisible()
    await expect(page.getByText('75').first()).toBeVisible()
    await expect(page.getByText('top 8%')).toBeVisible()
    await expect(page.getByText(/Posición 12 de 150 participantes/i)).toBeVisible()
    await expect(page.getByText('4 días')).toBeVisible()
    await expect(page.getByText('Votante comprometido')).toBeVisible()
    await expect(page.getByText(/25 puntos para alcanzar el nivel Líder/i)).toBeVisible()
    await expect(page.getByRole('img', { name: /evolución de puntuación cívica/i })).toBeVisible()
  })

  test('does not fabricate ranking or streak when analytics is unavailable', async ({ page }) => {
    await mockProfileApis(page, 503)
    await page.goto('/dashboard/reputation')

    await expect(page.getByRole('heading', { name: 'Ciudadano VÉRTICE' })).toBeVisible()
    await expect(page.getByText(/La comparación comunitaria no está disponible/i)).toBeVisible()
    await expect(page.getByText(/La analítica temporal no está disponible/i)).toBeVisible()
    await expect(page.getByText(/top \d+%/i)).toHaveCount(0)
    await expect(page.getByText(/15\.121 ciudadanos/i)).toHaveCount(0)
  })
})

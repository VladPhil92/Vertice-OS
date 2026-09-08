import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:4000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440099'

async function setupAuth(page: Page) {
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' }])
  await page.addInitScript((citizenId) => {
    localStorage.setItem('access_token', 'golden-browser-token')
    localStorage.setItem('citizen_id', citizenId)
  }, CITIZEN_ID)
}

test.describe('@golden safety boundaries', () => {
  test('@golden GJ-B05 identity: basic verification never implies governance assurance', async ({ page }) => {
    await setupAuth(page)

    await page.route(`${API}/identity/status`, (route) => route.fulfill({
      status: 200,
      json: {
        citizen_id: CITIZEN_ID,
        did: `did:vertice:${CITIZEN_ID}`,
        level: 2,
        level_name: 'Verificación básica completa',
        can_vote: true,
        can_propose: true,
      },
    }))
    await page.route(`${API}/identity/assurance`, (route) => route.fulfill({
      status: 200,
      json: {
        citizen_id: CITIZEN_ID,
        assured: false,
        status: 'required',
        governance_eligible: false,
        verification_level: 2,
        provider: null,
        provider_verified_at: null,
        provider_expires_at: null,
        requirements: {
          contact_verified: true,
          provider_ingress_operational: false,
          active_identity_proof: false,
          provider_external_certified: false,
        },
      },
    }))
    await page.route(`${API}/identity/me`, (route) => route.fulfill({
      status: 200,
      json: {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: `did:vertice:${CITIZEN_ID}`,
        verificationLevel: 2,
      },
    }))

    await page.goto('/dashboard/identity')

    await expect(page.getByRole('heading', { name: /tu identidad digital/i })).toBeVisible()
    await expect(page.getByText(/verificación básica completa/i).first()).toBeVisible()
    await expect(page.getByText(/requiere aseguramiento cívico/i)).toBeVisible()
    await expect(page.getByText(/la verificación básica y el inicio de sesión no sustituyen la prueba cívica/i)).toBeVisible()
  })

  test('@golden GJ-B06 crowdfunding: platform blockers suppress activation even when user is ready', async ({ page }) => {
    await setupAuth(page)

    await page.route(`${API}/crowdfunding/me/readiness`, (route) => route.fulfill({
      status: 200,
      json: {
        generated_at: '2026-09-08T20:00:00.000Z',
        identity: { state: 'ready', verified: true },
        payout_profile: {
          state: 'ready',
          verification_status: 'verified',
          payout_status: 'eligible',
          requested_at: '2026-09-08T18:00:00.000Z',
          verified_at: '2026-09-08T19:00:00.000Z',
          review_notes: null,
          can_request_review: false,
        },
        payout_destination: {
          state: 'ready',
          registered: true,
          key_type: 'PHONE',
        },
        platform: {
          ctg_one_federation: 'ready',
          collection_provider: 'misconfigured',
          crowdfunding_collection: 'disabled',
          payout_provider: 'misconfigured',
          payout_execution: 'disabled',
          payout_certification: 'not_verified',
        },
        blockers: [{
          code: 'COLLECTION_PROVIDER_NOT_READY',
          scope: 'platform',
          message: 'El proveedor de recaudo de producción todavía no está certificado.',
          action_href: null,
        }],
        user_ready: true,
        platform_ready: false,
        ready_for_campaign_activation: false,
        campaigns: [{
          id: CAMPAIGN_ID,
          title: 'Parque para todos',
          status: 'draft',
          compliance_status: 'verified',
          review_notes: null,
          lifecycle_ready: true,
          can_activate: false,
          can_accept_contributions: false,
          blockers: [{
            code: 'COLLECTION_PROVIDER_NOT_READY',
            scope: 'platform',
            message: 'Recaudo bloqueado hasta certificar el proveedor.',
            action_href: null,
          }],
        }],
      },
    }))

    await page.goto('/dashboard/crowdfunding/readiness')

    await expect(page.getByTestId('crowdfunding-readiness-workspace')).toBeVisible()
    await expect(page.getByText('Bloqueada', { exact: true })).toBeVisible()
    await expect(page.getByText('No habilitable', { exact: true })).toBeVisible()
    await expect(page.getByText(/proveedor de recaudo de producción todavía no está certificado/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /activar recaudo/i })).toHaveCount(0)
    await expect(page.getByText(/readiness controla dinero, no influencia cívica/i)).toBeVisible()
  })
})

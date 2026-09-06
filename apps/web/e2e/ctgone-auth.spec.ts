import { test, expect } from '@playwright/test'

const VERIFIER_KEY = 'vertice.ctgone.pkce_verifier'
const STATE_KEY = 'vertice.ctgone.state'

test.describe('CTG One federated auth entry', () => {
  test('offers CTG One for both registration and login', async ({ page }) => {
    await page.goto('/auth/login')

    const ctgOneEntry = page.getByRole('link', { name: /registrarse o ingresar con CTG One/i })
    await expect(ctgOneEntry).toBeVisible()
    await expect(ctgOneEntry).toHaveAttribute('href', '/auth/ctgone/start')

    await expect(page.getByText(/si ya tienes una cuenta CTG One, úsala para ingresar/i)).toBeVisible()
    await expect(page.getByText(/VÉRTICE creará tu cuenta ciudadana vinculada/i)).toBeVisible()
  })

  test('completes a valid callback through the same-origin exchange and creates the local session marker', async ({ page }) => {
    const state = 'release-gate-state-20260906'
    const verifier = 'v'.repeat(43)
    const code = 'c'.repeat(43)
    const citizenId = '00000000-0000-4000-8000-000000000001'
    let exchangePayload: unknown

    await page.goto('/auth/login')
    await page.evaluate(
      ({ stateValue, verifierValue, stateKey, verifierKey }) => {
        sessionStorage.setItem(stateKey, stateValue)
        sessionStorage.setItem(verifierKey, verifierValue)
      },
      {
        stateValue: state,
        verifierValue: verifier,
        stateKey: STATE_KEY,
        verifierKey: VERIFIER_KEY,
      },
    )

    await page.route('**/api/auth/ctgone/exchange', async (route) => {
      exchangePayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'release-gate-access-token',
          citizen_id: citizenId,
        }),
      })
    })

    await page.goto(`/auth/ctgone/callback?code=${code}&state=${state}`)
    await expect(page).toHaveURL(/\/dashboard(?:$|\?)/, { timeout: 10_000 })

    expect(exchangePayload).toEqual({ code, code_verifier: verifier })

    const browserState = await page.evaluate(
      ({ stateKey, verifierKey }) => ({
        accessToken: localStorage.getItem('access_token'),
        citizenId: localStorage.getItem('citizen_id'),
        state: sessionStorage.getItem(stateKey),
        verifier: sessionStorage.getItem(verifierKey),
      }),
      { stateKey: STATE_KEY, verifierKey: VERIFIER_KEY },
    )

    expect(browserState).toEqual({
      accessToken: 'release-gate-access-token',
      citizenId,
      state: null,
      verifier: null,
    })

    const cookies = await page.context().cookies()
    const sessionMarker = cookies.find((cookie) => cookie.name === 'vertice_auth')
    expect(sessionMarker?.value).toBe('1')
    expect(sessionMarker?.sameSite).toBe('Strict')
  })

  test('fails closed when callback state does not match the browser session', async ({ page }) => {
    const verifier = 'v'.repeat(43)
    const expectedState = 'expected-release-gate-state'
    const returnedState = 'tampered-release-gate-state'
    const code = 'c'.repeat(43)
    let exchangeCalls = 0

    await page.goto('/auth/login')
    await page.evaluate(
      ({ stateValue, verifierValue, stateKey, verifierKey }) => {
        sessionStorage.setItem(stateKey, stateValue)
        sessionStorage.setItem(verifierKey, verifierValue)
      },
      {
        stateValue: expectedState,
        verifierValue: verifier,
        stateKey: STATE_KEY,
        verifierKey: VERIFIER_KEY,
      },
    )

    await page.route('**/api/auth/ctgone/exchange', async (route) => {
      exchangeCalls += 1
      await route.abort()
    })

    await page.goto(`/auth/ctgone/callback?code=${code}&state=${returnedState}`)

    await expect(
      page.getByText(/la respuesta de CTG One no coincide con la sesión segura iniciada en este navegador/i),
    ).toBeVisible()
    expect(exchangeCalls).toBe(0)

    const browserState = await page.evaluate(
      ({ stateKey, verifierKey }) => ({
        accessToken: localStorage.getItem('access_token'),
        citizenId: localStorage.getItem('citizen_id'),
        state: sessionStorage.getItem(stateKey),
        verifier: sessionStorage.getItem(verifierKey),
      }),
      { stateKey: STATE_KEY, verifierKey: VERIFIER_KEY },
    )

    expect(browserState).toEqual({
      accessToken: null,
      citizenId: null,
      state: null,
      verifier: null,
    })
  })
})

import { expect, test } from '@playwright/test'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

test.describe('Login page', () => {
  test('renders the login contract', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
  })

  test('submits credentials and reaches dashboard', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) => route.fulfill({
      status: 200,
      json: {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 900,
        citizen_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    }))
    await page.route(`${API}/auth/me`, (route) => route.fulfill({
      status: 200,
      json: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        did: 'did:vertice:550e8400-e29b-41d4-a716-446655440000',
        email: 'juan@ejemplo.com',
        neighborhood: null,
        locality_id: null,
        reputation_score: '0',
        verification_level: 0,
        created_at: '2026-09-09T00:00:00.000Z',
        last_active_at: null,
      },
    }))
    await page.goto('/auth/login')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('juan@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123')
    await page.getByRole('button', { name: /ingresar/i }).click()
  })
})

test.describe('Register page', () => {
  test('renders current required fields', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/cédula de ciudadanía/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /crear cuenta/i })).toBeVisible()
  })

  test('rejects a short cedula through browser constraints', async ({ page }) => {
    await page.goto('/auth/register')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('juan@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123')
    const cedula = page.getByLabel(/cédula de ciudadanía/i)
    await cedula.fill('123')
    expect(await cedula.evaluate((element) => (element as HTMLInputElement).checkValidity())).toBe(false)
  })

  test('shows national territory continuation after successful registration', async ({ page }) => {
    await page.route(`${API}/auth/register`, (route) => route.fulfill({
      status: 201,
      json: { citizen_id: '550e8400-e29b-41d4-a716-446655440000', did: 'did:vertice:550e8400-e29b-41d4-a716-446655440000' },
    }))
    await page.goto('/auth/register')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('juan@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123')
    await page.getByLabel(/cédula de ciudadanía/i).fill('1234567890')
    await page.getByRole('button', { name: /crear cuenta/i }).click()
    await expect(page.getByRole('heading', { name: /cuenta creada/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /ingresar y elegir territorio/i })).toHaveAttribute(
      'href',
      '/auth/login?next=/dashboard/territory',
    )
  })
})

test.describe('Route protection', () => {
  test('redirects dashboard to login when unauthenticated', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('allows dashboard with session marker', async ({ page, context }) => {
    await context.addCookies([{ name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' }])
    await page.route(`${API}/identity/status`, (route) => route.fulfill({
      status: 200,
      json: { authenticated: true, citizen_id: '550e8400-e29b-41d4-a716-446655440000' },
    }))
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/auth\/login/)
  })
})

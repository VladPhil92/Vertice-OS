/**
 * Auth flow: login, register, and middleware redirect tests.
 * All API calls are intercepted — no backend required.
 */
import { test, expect } from '@playwright/test'

const API = 'http://localhost:4000'

// ─── Login ────────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('renders form and logo', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /ingresa a tu cuenta/i })).toBeVisible()
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) =>
      route.fulfill({ status: 401, json: { error: 'Credenciales inválidas' } }),
    )

    await page.goto('/auth/login')
    await page.getByLabel(/correo electrónico/i).fill('test@ejemplo.com')
    await page.getByLabel(/contraseña/i).fill('wrongpass')
    await page.getByRole('button', { name: /ingresar/i }).click()

    await expect(page.getByText('Credenciales inválidas')).toBeVisible()
  })

  test('redirects to /dashboard after successful login', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          access_token: 'test-jwt-token',
          citizen_id: '550e8400-e29b-41d4-a716-446655440000',
          expires_in: 3600,
        },
      }),
    )

    await page.goto('/auth/login')
    await page.getByLabel(/correo electrónico/i).fill('ciudadano@ejemplo.com')
    await page.getByLabel(/contraseña/i).fill('password123')
    await page.getByRole('button', { name: /ingresar/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('respects ?next= redirect param after login', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          access_token: 'test-jwt-token',
          citizen_id: '550e8400-e29b-41d4-a716-446655440000',
          expires_in: 3600,
        },
      }),
    )

    await page.goto('/auth/login?next=/dashboard/reports')
    await page.getByLabel(/correo electrónico/i).fill('ciudadano@ejemplo.com')
    await page.getByLabel(/contraseña/i).fill('password123')
    await page.getByRole('button', { name: /ingresar/i }).click()

    await expect(page).toHaveURL(/\/dashboard\/reports/)
  })

  test('shows password toggle', async ({ page }) => {
    await page.goto('/auth/login')
    const passwordInput = page.getByLabel(/contraseña/i)
    await expect(passwordInput).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: /mostrar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: /ocultar contraseña/i }).click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('link to register page is visible', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('link', { name: /regístrate aquí/i })).toBeVisible()
  })
})

// ─── Register ─────────────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test('renders all required fields', async ({ page }) => {
    await page.goto('/auth/register')
    await expect(page.getByLabel(/nombre/i)).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/cédula/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /crear cuenta/i })).toBeVisible()
  })

  test('shows validation error for short cedula', async ({ page }) => {
    await page.goto('/auth/register')

    await page.getByLabel(/nombre/i).fill('Juan Ciudadano')
    await page.getByLabel(/correo/i).fill('juan@ejemplo.com')
    await page.getByLabel(/cédula/i).fill('123')
    await page.getByLabel(/contraseña/i).first().fill('password123')

    await page.getByRole('button', { name: /crear cuenta/i }).click()

    await expect(page.getByText(/cédula/i)).toBeVisible()
  })

  test('redirects to /dashboard after successful registration', async ({ page }) => {
    await page.route(`${API}/auth/register`, (route) =>
      route.fulfill({
        status: 201,
        json: {
          access_token: 'test-jwt-token',
          citizen_id: '550e8400-e29b-41d4-a716-446655440000',
          expires_in: 3600,
        },
      }),
    )

    await page.goto('/auth/register')
    await page.getByLabel(/nombre/i).fill('Juan Ciudadano')
    await page.getByLabel(/correo electrónico/i).fill('juan@ejemplo.com')
    await page.getByLabel(/cédula/i).fill('1234567890')
    const passwords = page.getByLabel(/contraseña/i)
    await passwords.nth(0).fill('password123')
    await passwords.nth(1).fill('password123')

    await page.getByRole('button', { name: /crear cuenta/i }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })
})

// ─── Middleware / route protection ────────────────────────────────────────────

test.describe('Route protection (Edge Middleware)', () => {
  test('redirects /dashboard to /auth/login when not authenticated', async ({ page }) => {
    // No vertice_auth cookie → middleware should redirect
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('allows /dashboard when vertice_auth cookie is set', async ({ page, context }) => {
    // Seed the auth cookie and mock the API calls the page makes
    await context.addCookies([
      { name: 'vertice_auth', value: '1', domain: 'localhost', path: '/' },
    ])

    await page.route(`${API}/identity/status`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          citizen_id: '550e8400-e29b-41d4-a716-446655440000',
          did: 'did:vertice:cartagena:abc123',
          level: 1,
          level_name: 'Ciudadano',
          can_vote: false,
          can_propose: false,
          verified_at: null,
        },
      }),
    )

    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('includes ?next= param in redirect URL', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard/reports')
    await expect(page).toHaveURL(/\/auth\/login\?next=.*reports/)
  })
})

import { test, expect } from '@playwright/test'

const API = '**/api'

test.describe('Login page', () => {
  test('renders accessible form', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /ingresa a tu cuenta/i })).toBeVisible()
    await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^ingresar$/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) => route.fulfill({ status: 401, json: { error: 'Credenciales inválidas' } }))
    await page.goto('/auth/login')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('test@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('wrongpass')
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await expect(page.getByText('Credenciales inválidas')).toBeVisible()
  })

  test('redirects to dashboard after successful login', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) => route.fulfill({
      status: 200,
      json: { access_token: 'test-jwt-token', citizen_id: '550e8400-e29b-41d4-a716-446655440000', expires_in: 3600 },
    }))
    await page.goto('/auth/login')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('ciudadano@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('password123')
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('ignores a client supplied next target after login', async ({ page }) => {
    await page.route(`${API}/auth/token`, (route) => route.fulfill({
      status: 200,
      json: { access_token: 'test-jwt-token', citizen_id: '550e8400-e29b-41d4-a716-446655440000', expires_in: 3600 },
    }))
    await page.goto('/auth/login?next=/dashboard/reports')
    await page.getByLabel('Correo electrónico', { exact: true }).fill('ciudadano@ejemplo.com')
    await page.getByLabel('Contraseña', { exact: true }).fill('password123')
    await page.getByRole('button', { name: /^ingresar$/i }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('shows password toggle', async ({ page }) => {
    await page.goto('/auth/login')
    const password = page.getByLabel('Contraseña', { exact: true })
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: /mostrar contraseña/i }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: /ocultar contraseña/i }).click()
    await expect(password).toHaveAttribute('type', 'password')
  })

  test('link to register page is visible', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('link', { name: /regístrate aquí/i })).toBeVisible()
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

  test('shows completion after successful registration', async ({ page }) => {
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
    await expect(page.getByRole('link', { name: /ingresar ahora/i })).toHaveAttribute('href', '/auth/login')
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
      json: {
        citizen_id: '550e8400-e29b-41d4-a716-446655440000',
        did: 'did:vertice:cartagena:abc123',
        level: 1,
        level_name: 'Ciudadano',
        can_vote: false,
        can_propose: false,
        verified_at: null,
      },
    }))
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('middleware preserves requested path in the unauthenticated login URL', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard/reports')
    await expect(page).toHaveURL(/\/auth\/login\?next=.*reports/)
  })
})

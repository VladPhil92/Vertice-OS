import { test, expect } from '@playwright/test'

test.describe('CTG One federated auth entry', () => {
  test('offers CTG One for both registration and login', async ({ page }) => {
    await page.goto('/auth/login')

    const ctgOneEntry = page.getByRole('link', { name: /registrarse o ingresar con CTG One/i })
    await expect(ctgOneEntry).toBeVisible()
    await expect(ctgOneEntry).toHaveAttribute('href', '/auth/ctgone/start')

    await expect(page.getByText(/si ya tienes una cuenta CTG One, úsala para ingresar/i)).toBeVisible()
    await expect(page.getByText(/VÉRTICE creará tu cuenta ciudadana vinculada/i)).toBeVisible()
  })
})

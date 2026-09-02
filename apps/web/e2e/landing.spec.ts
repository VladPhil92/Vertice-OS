import { expect, test } from '@playwright/test'

test.describe('Public landing', () => {
  test('explains the civic value proposition and exposes the core journey', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /lo que pasa en tu barrio puede convertirse en acción pública/i }),
    ).toBeVisible()

    await expect(page.locator('#proposito')).toContainText('No es otra red social')
    await expect(page.locator('#como-funciona')).toContainText('Un ciclo cívico completo')
    await expect(page.locator('#capacidades')).toContainText('Seis capacidades conectadas')
    await expect(page.locator('#ia')).toContainText('La decisión sigue siendo humana')
  })

  test('keeps registration and login as the primary public routes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /crear mi identidad cívica/i })).toHaveAttribute(
      'href',
      '/auth/register',
    )
    await expect(page.getByRole('link', { name: /^ingresar$/i }).first()).toHaveAttribute(
      'href',
      '/auth/login',
    )

    await expect(page.locator('a[href="/docs"]')).toHaveCount(0)
    await expect(page.locator('a[href^="/legal/"]')).toHaveCount(0)
  })
})

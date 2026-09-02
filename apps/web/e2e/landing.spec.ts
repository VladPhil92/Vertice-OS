import { expect, test } from '@playwright/test'

test.describe('Public landing', () => {
  test('explains the product journey with the institutional visual system', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /cartagena la construimos juntos/i }),
    ).toBeVisible()

    await expect(page.getByAltText(/vértice — inteligencia ciudadana/i).first()).toBeVisible()
    await expect(
      page.getByAltText(/ilustración de cartagena conectada por una red/i),
    ).toBeVisible()
    await expect(
      page.getByAltText(/red de inteligencia ciudadana/i),
    ).toBeVisible()

    await expect(page.locator('#proposito')).toContainText('Una plataforma ciudadana')
    await expect(page.locator('#como-funciona')).toContainText('de la señal al seguimiento')
    await expect(page.locator('#capacidades')).toContainText('Herramientas conectadas')
    await expect(page.locator('#ia')).toContainText('La decisión sigue siendo humana')

    await expect(page.getByText('Portal VÉRTICE', { exact: true })).toHaveCount(0)
  })

  test('keeps registration and login as the primary public routes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /tu voz tiene poder/i })).toHaveAttribute(
      'href',
      '/auth/register',
    )
    await expect(page.getByRole('link', { name: /iniciar sesión/i }).first()).toHaveAttribute(
      'href',
      '/auth/login',
    )

    await expect(page.locator('a[href="/docs"]')).toHaveCount(0)
    await expect(page.locator('a[href^="/legal/"]')).toHaveCount(0)
  })
})

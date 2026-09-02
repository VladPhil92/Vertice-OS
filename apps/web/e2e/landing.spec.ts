import { expect, test } from '@playwright/test'

test.describe('Public landing', () => {
  test('renders the approved civic homepage with compiled layout styles', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: /cartagena la construimos juntos/i }),
    ).toBeVisible()

    const brand = page.getByAltText(/vértice — inteligencia ciudadana/i).first()
    await expect(brand).toBeVisible()
    await expect(
      page.getByAltText(/ilustración de cartagena conectada por una red/i),
    ).toBeVisible()
    await expect(
      page.getByAltText(/red cívica de vértice/i),
    ).toBeVisible()

    await expect(page.locator('#proposito')).toContainText('Una plataforma ciudadana')
    await expect(page.locator('#como-funciona')).toContainText('De una señal del territorio')
    await expect(page.locator('#capacidades')).toContainText('Seis herramientas')
    await expect(page.locator('#ia')).toContainText('La decisión sigue siendo humana')
    await expect(page.locator('#vision')).toContainText('La ciudadanía es el vértice del cambio')

    const navDisplay = await page.locator('header nav').evaluate((element) => getComputedStyle(element).display)
    expect(navDisplay).toBe('flex')

    const headline = await page.getByRole('heading', { name: /cartagena la construimos juntos/i }).boundingBox()
    expect(headline?.width ?? 0).toBeGreaterThan(280)

    const brandBox = await brand.boundingBox()
    expect(brandBox?.width ?? 0).toBeGreaterThanOrEqual(185)

    const listStyle = await page.locator('header ul').evaluate((element) => getComputedStyle(element).listStyleType)
    expect(listStyle).toBe('none')

    await expect(page.locator('#capacidades a[href^="/dashboard/"]')).toHaveCount(6)
    await expect(page.getByText('Portal VÉRTICE', { exact: true })).toHaveCount(0)
  })

  test('keeps registration and login as the primary public routes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /tu voz tiene poder/i })).toHaveAttribute(
      'href',
      '/auth/register',
    )
    await expect(page.getByRole('link', { name: /^ingresar$/i }).first()).toHaveAttribute(
      'href',
      '/auth/login',
    )
    await expect(page.getByRole('link', { name: /^crear cuenta$/i }).first()).toHaveAttribute(
      'href',
      '/auth/register',
    )

    await expect(page.locator('a[href="/docs"]')).toHaveCount(0)
    await expect(page.locator('a[href^="/legal/"]')).toHaveCount(0)
  })
})

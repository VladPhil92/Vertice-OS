import { expect, type Locator, type Page, test } from '@playwright/test'

async function tabTo(page: Page, locator: Locator, maxTabs = 12) {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate((element) => document.activeElement === element)) return
  }
  throw new Error(`Keyboard focus never reached ${await locator.evaluate((element) => element.outerHTML.slice(0, 160))}`)
}

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused()
  const hasVisibleFocus = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    const outlineVisible = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth || '0') > 0
    const shadowVisible = style.boxShadow !== 'none' && style.boxShadow.trim().length > 0
    return outlineVisible || shadowVisible
  })
  expect(hasVisibleFocus).toBe(true)
}

test.describe('Authentication accessibility keyboard contract', () => {
  test('login exposes a single main landmark and keyboard-visible focus on critical controls', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresa a tu cuenta' })).toBeVisible()

    const email = page.locator('#login-email')
    const password = page.locator('#login-password')
    const passwordToggle = page.getByRole('button', { name: 'Mostrar contraseña' })
    const submit = page.getByRole('button', { name: 'Ingresar' })

    await tabTo(page, email)
    await expectVisibleKeyboardFocus(email)
    await tabTo(page, password)
    await expectVisibleKeyboardFocus(password)
    await tabTo(page, passwordToggle)
    await expectVisibleKeyboardFocus(passwordToggle)

    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')

    await tabTo(page, submit)
    await expectVisibleKeyboardFocus(submit)
  })

  test('registration exposes a single main landmark, programmatic help and keyboard-visible focus', async ({ page }) => {
    await page.goto('/auth/register')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta ciudadana' })).toBeVisible()

    const email = page.locator('#register-email')
    const password = page.locator('#register-password')
    const passwordToggle = page.getByRole('button', { name: 'Mostrar contraseña' })
    const cedula = page.locator('#register-cedula')
    const submit = page.getByRole('button', { name: 'Crear cuenta' })

    await expect(cedula).toHaveAttribute('aria-describedby', 'register-cedula-help')
    await expect(page.locator('#register-cedula-help')).toBeVisible()

    await tabTo(page, email)
    await expectVisibleKeyboardFocus(email)
    await tabTo(page, password)
    await expectVisibleKeyboardFocus(password)
    await tabTo(page, passwordToggle)
    await expectVisibleKeyboardFocus(passwordToggle)
    await tabTo(page, cedula)
    await expectVisibleKeyboardFocus(cedula)
    await tabTo(page, submit)
    await expectVisibleKeyboardFocus(submit)
  })
})

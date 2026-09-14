import { expect, type Locator, type Page, test } from '@playwright/test'

type FocusStyle = {
  outlineStyle: string
  outlineWidth: string
  outlineColor: string
  boxShadow: string
}

async function tabTo(page: Page, locator: Locator, maxTabs = 12) {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate((element) => document.activeElement === element)) return
  }
  throw new Error(`Keyboard focus never reached ${await locator.evaluate((element) => element.outerHTML.slice(0, 160))}`)
}

async function readFocusStyle(locator: Locator): Promise<FocusStyle> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    }
  })
}

function visibleFocusStyle(style: FocusStyle) {
  const outlineVisible = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth || '0') > 0
  const shadowVisible = style.boxShadow !== 'none' && style.boxShadow.trim().length > 0
  return outlineVisible || shadowVisible
}

function focusStyleChanged(before: FocusStyle, after: FocusStyle) {
  return before.outlineStyle !== after.outlineStyle
    || before.outlineWidth !== after.outlineWidth
    || before.outlineColor !== after.outlineColor
    || before.boxShadow !== after.boxShadow
}

async function tabToWithVisibleKeyboardFocus(page: Page, locator: Locator, maxTabs = 12) {
  const unfocusedStyle = await readFocusStyle(locator)
  await tabTo(page, locator, maxTabs)
  await expect(locator).toBeFocused()
  await expect.poll(async () => {
    const focusedStyle = await readFocusStyle(locator)
    return visibleFocusStyle(focusedStyle) && focusStyleChanged(unfocusedStyle, focusedStyle)
  }).toBe(true)
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

    await tabToWithVisibleKeyboardFocus(page, email)
    await tabToWithVisibleKeyboardFocus(page, password)
    await tabToWithVisibleKeyboardFocus(page, passwordToggle)

    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute('aria-pressed', 'true')

    await tabToWithVisibleKeyboardFocus(page, submit)
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

    await tabToWithVisibleKeyboardFocus(page, email)
    await tabToWithVisibleKeyboardFocus(page, password)
    await tabToWithVisibleKeyboardFocus(page, passwordToggle)
    await tabToWithVisibleKeyboardFocus(page, cedula)
    await tabToWithVisibleKeyboardFocus(page, submit)
  })
})

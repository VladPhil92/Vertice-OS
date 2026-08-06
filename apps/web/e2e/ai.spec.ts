import { test, expect, type Page } from '@playwright/test'

async function setupAuth(page: Page) {
  await page.context().addCookies([{
    name: 'vertice_auth',
    value: '1',
    domain: 'localhost',
    path: '/',
  }])
  await page.addInitScript(() => {
    // Minimal JWT payload with role=citizen, lvl=1
    const payload = btoa(JSON.stringify({ sub: 'test-id', lvl: 1, role: 'citizen' }))
    localStorage.setItem('access_token', `header.${payload}.sig`)
  })
}

test.describe('AI Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page)
  })

  test('renders empty state with suggested prompts', async ({ page }) => {
    await page.goto('/dashboard/ai')
    await expect(page.getByText('¿En qué puedo ayudarte?')).toBeVisible()
    await expect(page.getByText('¿Cómo presento un derecho de petición?')).toBeVisible()
    await expect(page.getByText('Ayúdame a redactar una propuesta ciudadana')).toBeVisible()
  })

  test('sends a message and shows AI response', async ({ page }) => {
    await page.route('**/ai/query', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Para presentar un derecho de petición en Cartagena, dirígete a la Alcaldía Distrital.',
          intent: 'legal',
          agent_used: 'legal',
          confidence: 0.92,
          audit_id: 'test-audit-1',
        }),
      })
    })

    await page.goto('/dashboard/ai')
    await page.getByPlaceholder(/escribe tu pregunta/i).fill('¿Cómo presento un derecho de petición?')
    await page.getByRole('button', { name: /enviar/i }).click()

    await expect(page.getByText('Para presentar un derecho de petición en Cartagena')).toBeVisible()
    await expect(page.getByText('Asesoría Legal')).toBeVisible()
  })

  test('clicking suggested prompt sends it directly', async ({ page }) => {
    let capturedBody = ''
    await page.route('**/ai/query', async route => {
      capturedBody = route.request().postData() ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Aquí están las propuestas en debate actualmente.',
          intent: 'governance',
          agent_used: 'governance',
          confidence: 0.88,
          audit_id: 'test-audit-2',
        }),
      })
    })

    await page.goto('/dashboard/ai')
    await page.getByText('¿Qué propuestas están en debate actualmente?').click()

    await expect(page.getByText('Aquí están las propuestas en debate actualmente.')).toBeVisible()
    expect(capturedBody).toContain('debate')
  })

  test('shows error message when AI service is unavailable', async ({ page }) => {
    await page.route('**/ai/query', route => route.fulfill({ status: 502, body: '{}' }))

    await page.goto('/dashboard/ai')
    await page.getByPlaceholder(/escribe tu pregunta/i).fill('Hola')
    await page.getByRole('button', { name: /enviar/i }).click()

    await expect(page.getByText(/servicio de ia no está disponible|error interno/i)).toBeVisible()
  })

  test('Enter submits, Shift+Enter creates newline', async ({ page }) => {
    let called = false
    await page.route('**/ai/query', async route => {
      called = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: 'ok', intent: 'general', agent_used: 'router', confidence: 0.5, audit_id: 'x' }),
      })
    })

    await page.goto('/dashboard/ai')
    const textarea = page.getByPlaceholder(/escribe tu pregunta/i)

    // Shift+Enter should NOT submit
    await textarea.fill('línea 1')
    await textarea.press('Shift+Enter')
    expect(called).toBe(false)

    // Enter should submit
    await textarea.fill('enviar esto')
    await textarea.press('Enter')
    await expect(page.getByText('ok')).toBeVisible()
    expect(called).toBe(true)
  })
})

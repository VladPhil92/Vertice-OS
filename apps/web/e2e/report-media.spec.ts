import { expect, test, type Page } from '@playwright/test'

const MEDIA_ASSET_ID = '550e8400-e29b-41d4-a716-446655440010'

async function setupAuth(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
  await page.context().addCookies([
    { name: 'vertice_auth', value: '1', url: baseURL },
  ])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-jwt-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440000')
  })
}

test.describe('Territorial evidence media', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupAuth(page)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 10.391, longitude: -75.4794 })
  })

  test('uploads provider-backed evidence and submits only confirmed media asset ids', async ({ page }) => {
    let submittedBody: Record<string, unknown> | null = null

    // The glob intentionally supports both development (direct local API) and
    // production/same-origin (/api proxy) so this spec can serve as a release gate.
    await page.route('**/territorial/media/upload-intent', (route) => route.fulfill({
      status: 200,
      json: {
        media_asset_id: MEDIA_ASSET_ID,
        upload_url: 'https://upload.imagedelivery.net/mock-direct-upload',
      },
    }))
    await page.route('https://upload.imagedelivery.net/**', (route) => route.fulfill({
      status: 200,
      json: { success: true },
    }))
    await page.route('**/territorial/media/confirm', (route) => route.fulfill({
      status: 200,
      json: {
        media_asset_id: MEDIA_ASSET_ID,
        url: 'https://imagedelivery.net/account/mock/public',
        status: 'confirmed',
      },
    }))
    await page.route('**/territorial/reports*', (route) => {
      if (route.request().method() === 'POST') {
        submittedBody = route.request().postDataJSON() as Record<string, unknown>
        return route.fulfill({
          status: 201,
          json: {
            id: '550e8400-e29b-41d4-a716-446655440020',
            title: 'Alumbrado dañado en parque comunitario',
          },
        })
      }
      return route.fulfill({ status: 200, json: { data: [], count: 0 } })
    })

    await page.goto('/dashboard/reports/new')
    await page.getByLabel(/título/i).fill('Alumbrado dañado en parque comunitario')
    await page.getByLabel(/descripción/i).fill(
      'Tres luminarias permanecen apagadas desde hace varios días y el parque queda completamente oscuro durante la noche.',
    )

    await page.locator('#report-evidence').setInputFiles({
      name: 'parque.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
    })
    await expect(page.getByText('Lista para cargar')).toBeVisible()

    await page.getByRole('button', { name: /enviar reporte/i }).click()
    await expect(page).toHaveURL('/dashboard/reports')
    expect(submittedBody).toMatchObject({ media_asset_ids: [MEDIA_ASSET_ID] })
    expect(submittedBody).not.toHaveProperty('media_urls')
  })

  test('enforces the five-image client cap before upload', async ({ page }) => {
    await page.goto('/dashboard/reports/new')
    await page.locator('#report-evidence').setInputFiles(
      Array.from({ length: 6 }, (_, index) => ({
        name: `evidence-${index + 1}.jpg`,
        mimeType: 'image/jpeg',
        buffer: Buffer.from(`image-${index + 1}`),
      })),
    )

    await expect(page.getByText('5/5')).toBeVisible()
    await expect(page.getByText(/máximo 5 fotografías/i)).toBeVisible()
  })
})

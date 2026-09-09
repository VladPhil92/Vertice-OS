import { test, expect, type Page } from '@playwright/test'

const citizenId = '550e8400-e29b-41d4-a716-446655440010'

async function setupAdminShell(page: Page) {
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
  await page.context().addCookies([{ name: 'vertice_auth', value: '1', url: baseURL }])
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'phase4-finance-superadmin-token')
    localStorage.setItem('citizen_id', '550e8400-e29b-41d4-a716-446655440010')
  })
  await page.route('**/auth/roles', (route) => route.fulfill({
    status: 200,
    json: { assigned_roles: ['citizen', 'admin', 'superadmin'], active_role: 'superadmin' },
  }))
  await page.route('**/api/notifications', (route) => route.fulfill({ status: 200, json: { notifications: [], unread: 0 } }))
  await page.route('**/community/profile/me/avatar', (route) => route.fulfill({ status: 200, json: { citizen_id: citizenId, avatar_url: null, status: 'missing', upload_enabled: false } }))
  await page.route('**/community/profile/me', (route) => route.fulfill({
    status: 200,
    json: {
      citizen_id: citizenId,
      display_name: 'Operador financiero',
      neighborhood: 'Cartagena',
      profile_type: 'citizen',
      bio: null,
      organization: null,
      public_profile: false,
      reputation_score: 0,
    },
  }))
}

function commandCenter(collectionStopped = false) {
  return {
    state: collectionStopped ? 'blocked' : 'degraded',
    generatedAt: '2026-09-09T01:00:00.000Z',
    providers: { mercadopago: 'ready', wompiPayouts: 'disabled' },
    releaseSwitches: { crowdfundingCollectionEnabled: true, crowdfundingPayoutsEnabled: false },
    controls: [
      { capability: 'pro_checkout', emergency_stop: false, reason: null, updated_by_citizen_id: null, updated_at: '2026-09-09T00:55:00.000Z' },
      { capability: 'crowdfunding_collection', emergency_stop: collectionStopped, reason: collectionStopped ? 'Provider webhook incident' : null, updated_by_citizen_id: collectionStopped ? citizenId : null, updated_at: '2026-09-09T00:56:00.000Z' },
      { capability: 'crowdfunding_payouts', emergency_stop: false, reason: null, updated_by_citizen_id: null, updated_at: '2026-09-09T00:55:00.000Z' },
    ],
    metrics: {
      pendingPayments: 3,
      stalePendingPayments: 1,
      providerStateUnknown: 1,
      paid24hCop: 420000,
      platformFees24hCop: 10500,
      failedWebhooks24h: 1,
      staleReceivedWebhooks: 0,
      pendingRefunds: 1,
      refundsReconciliationRequired: 0,
      payoutsInFlight: 0,
      payoutsReconciliationRequired: 0,
      openRiskFlags: 2,
      escalatedRiskFlags: 1,
      criticalRiskFlags: 0,
    },
    slos: {
      stalePaymentsClear: false,
      webhookBacklogClear: true,
      webhookFailures24hClear: false,
      refundReconciliationClear: true,
      payoutReconciliationClear: true,
      criticalRiskClear: true,
    },
    finance: {
      provider: 'ready',
      reconciliation: null,
      openRiskFlags: 2,
      pendingRefunds: 1,
    },
    payoutOperations: {
      readiness: 'blocked',
      operationallyCertified: false,
      executionEnabled: false,
      providerState: 'disabled',
    },
    certificationBoundary: {
      internalFinancialIntegrity: 'integrated',
      providerMoneyMovement: 'requires_external_canary',
    },
  }
}

test.describe('Financial Operations Command Center Phase 4', () => {
  test('surfaces provider state, SLO degradation and certification boundary', async ({ page }) => {
    await setupAdminShell(page)
    await page.route('**/billing/admin/finance/command-center', (route) => route.fulfill({ status: 200, json: commandCenter(false) }))

    await page.goto('/dashboard/admin/finance')

    await expect(page.getByTestId('finance-operations-command-center')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Command Center financiero' })).toBeVisible()
    await expect(page.getByText('Pagado últimas 24h')).toBeVisible()
    await expect(page.getByText(/420\.000/)).toBeVisible()
    await expect(page.getByText('Mercado Pago')).toBeVisible()
    await expect(page.getByText('Wompi BRE-B')).toBeVisible()
    await expect(page.getByText(/requires_external_canary/)).toBeVisible()
    await expect(page.getByText('stalePaymentsClear: ATTENTION')).toBeVisible()
  })

  test('activates one rail stop while keeping recovery actions available', async ({ page }) => {
    await setupAdminShell(page)
    let collectionStopped = false
    let controlBody: unknown = null
    let reconciliationQueued = false

    await page.route('**/billing/admin/finance/command-center', (route) => route.fulfill({ status: 200, json: commandCenter(collectionStopped) }))
    await page.route('**/billing/admin/finance/controls/crowdfunding_collection', async (route) => {
      controlBody = route.request().postDataJSON()
      collectionStopped = Boolean((controlBody as { emergencyStop?: boolean }).emergencyStop)
      await route.fulfill({ status: 200, json: commandCenter(collectionStopped).controls[1] })
    })
    await page.route('**/billing/admin/finance/reconcile/enqueue', async (route) => {
      reconciliationQueued = true
      await route.fulfill({ status: 202, json: { queued: true } })
    })
    await page.route('**/billing/admin/finance/risk/scan', (route) => route.fulfill({ status: 200, json: { flagged: 0 } }))

    await page.goto('/dashboard/admin/finance')
    const collection = page.locator('article').filter({ hasText: 'Recaudo crowdfunding' })
    await collection.getByPlaceholder('Razón obligatoria si necesitas detener este rail').fill('Provider webhook incident')
    await collection.getByRole('button', { name: 'Emergency stop' }).click()

    await expect(collection.getByRole('button', { name: 'Restaurar rail' })).toBeVisible()
    expect(controlBody).toEqual({ emergencyStop: true, reason: 'Provider webhook incident' })

    await page.getByRole('button', { name: 'Encolar conciliación' }).click()
    expect(reconciliationQueued).toBe(true)
    await expect(page.getByRole('button', { name: 'Escanear riesgo' })).toBeVisible()
  })
})

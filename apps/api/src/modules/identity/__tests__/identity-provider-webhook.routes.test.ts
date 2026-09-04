import { buildApp } from '../../../app'

describe('native provider webhook ingress', () => {
  it('fails closed when no compiled native provider adapter exists', async () => {
    const app = buildApp()
    await app.ready()

    const response = await app.inject({
      method: 'POST',
      url: '/identity/providers/trusted_kyc/webhook',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ event: 'synthetic-provider-must-not-run-in-native-ingress' }),
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({
      code: 'NATIVE_PROVIDER_ADAPTER_UNAVAILABLE',
    })

    await app.close()
  })
})

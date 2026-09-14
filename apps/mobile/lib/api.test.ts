jest.mock('./session', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  setSessionTokens: jest.fn(),
  clearSessionTokens: jest.fn(),
}))

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response
}

describe('apps/mobile lib/api', () => {
  let session: {
    getAccessToken: jest.Mock
    getRefreshToken: jest.Mock
    setSessionTokens: jest.Mock
    clearSessionTokens: jest.Mock
  }
  let api: typeof import('./api')

  beforeEach(() => {
    jest.resetModules()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    session = require('./session')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    api = require('./api')
    globalThis.fetch = jest.fn()
  })

  describe('apiFetch', () => {
    it('attaches the bearer token from session storage to an authenticated call', async () => {
      session.getAccessToken.mockResolvedValueOnce('token-abc')
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ ok: true }))

      await api.apiFetch('/dashboard')

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/dashboard',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
      )
    })

    it('never reads or sends a token for a public call', async () => {
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse({ ok: true }))

      await api.apiFetch('/auth/mobile/token', { public: true })

      expect(session.getAccessToken).not.toHaveBeenCalled()
      const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers
      expect(headers.Authorization).toBeUndefined()
    })

    it('refreshes the access token once on 401 and retries the original request', async () => {
      session.getAccessToken.mockResolvedValue('stale-token')
      session.getRefreshToken.mockResolvedValueOnce('refresh-token')
      ;(globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401)) // original call
        .mockResolvedValueOnce(jsonResponse({ access_token: 'fresh-token' })) // /auth/mobile/refresh
        .mockResolvedValueOnce(jsonResponse({ ok: true })) // retried original call

      const result = await api.apiFetch<{ ok: boolean }>('/dashboard')

      expect(result).toEqual({ ok: true })
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:4000/auth/mobile/refresh',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        3,
        'http://localhost:4000/dashboard',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) }),
      )
      expect(session.setSessionTokens).toHaveBeenCalledWith('fresh-token')
      expect(session.clearSessionTokens).not.toHaveBeenCalled()
    })

    it('clears the session and throws when the refresh token is also invalid', async () => {
      session.getAccessToken.mockResolvedValue('stale-token')
      session.getRefreshToken.mockResolvedValueOnce('dead-refresh-token')
      ;(globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401)) // original call
        .mockResolvedValueOnce(jsonResponse({ error: 'invalid' }, 401)) // /auth/mobile/refresh fails

      await expect(api.apiFetch('/dashboard')).rejects.toThrow('expired')

      expect(globalThis.fetch).toHaveBeenCalledTimes(2)
      expect(session.clearSessionTokens).toHaveBeenCalledTimes(2)
    })

    it('deduplicates concurrent refresh attempts behind a single in-flight request', async () => {
      session.getAccessToken.mockResolvedValue('stale-token')
      session.getRefreshToken.mockResolvedValue('refresh-token')
      const fetchMock = globalThis.fetch as jest.Mock
      fetchMock.mockImplementation((url: string) => {
        if (url.endsWith('/auth/mobile/refresh')) {
          return Promise.resolve(jsonResponse({ access_token: 'fresh-token' }))
        }
        return Promise.resolve(jsonResponse({ ok: true }))
      })
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401))
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'expired' }, 401))

      const firstCall = api.apiFetch('/dashboard')
      const secondCall = api.apiFetch('/reports')
      await Promise.all([firstCall, secondCall])

      const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/mobile/refresh'))
      expect(refreshCalls).toHaveLength(1)
    })
  })

  describe('apiMutation idempotency', () => {
    it('reuses the same Idempotency-Key when the identical mutation is retried after a failure', async () => {
      session.getAccessToken.mockResolvedValue('token-abc')
      ;(globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(jsonResponse({ error: 'timeout' }, 503))
        .mockResolvedValueOnce(jsonResponse({ ok: true }))

      const body = JSON.stringify({ reportId: 'r1' })
      await expect(api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body })).rejects.toThrow()
      await api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body })

      const firstKey = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers['Idempotency-Key']
      const secondKey = (globalThis.fetch as jest.Mock).mock.calls[1][1].headers['Idempotency-Key']
      expect(firstKey).toBe(secondKey)
    })

    it('issues a new Idempotency-Key once the mutation has already succeeded', async () => {
      session.getAccessToken.mockResolvedValue('token-abc')
      ;(globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(jsonResponse({ ok: true }))
        .mockResolvedValueOnce(jsonResponse({ ok: true }))

      const body = JSON.stringify({ reportId: 'r1' })
      await api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body })
      await api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body })

      const firstKey = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers['Idempotency-Key']
      const secondKey = (globalThis.fetch as jest.Mock).mock.calls[1][1].headers['Idempotency-Key']
      expect(firstKey).not.toBe(secondKey)
    })

    it('issues a different Idempotency-Key for a different payload on the same route', async () => {
      session.getAccessToken.mockResolvedValue('token-abc')
      ;(globalThis.fetch as jest.Mock)
        .mockResolvedValueOnce(jsonResponse({ error: 'timeout' }, 503))
        .mockResolvedValueOnce(jsonResponse({ error: 'timeout' }, 503))

      await expect(
        api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body: JSON.stringify({ reportId: 'r1' }) }),
      ).rejects.toThrow()
      await expect(
        api.apiMutation('/workflows/cases', 'workflow-case', { method: 'POST', body: JSON.stringify({ reportId: 'r2' }) }),
      ).rejects.toThrow()

      const firstKey = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers['Idempotency-Key']
      const secondKey = (globalThis.fetch as jest.Mock).mock.calls[1][1].headers['Idempotency-Key']
      expect(firstKey).not.toBe(secondKey)
    })
  })
})

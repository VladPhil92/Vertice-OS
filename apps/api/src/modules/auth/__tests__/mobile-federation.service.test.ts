jest.mock('../../../lib/redis', () => ({
  redis: { set: jest.fn(), eval: jest.fn() },
}))

jest.mock('../federation.service', () => ({
  exchangeCtgOneFederation: jest.fn(),
}))

import { redis } from '../../../lib/redis'
import { exchangeCtgOneFederation } from '../federation.service'
import {
  exchangeMobileCtgOneFederation,
  startMobileCtgOneFederation,
} from '../mobile-federation.service'

const mockSet = redis.set as jest.Mock
const mockEval = redis.eval as jest.Mock
const mockExchange = exchangeCtgOneFederation as jest.Mock

// The exact Lua source mobile-federation.service.ts sends to redis.eval for
// single-use consumption. Asserted verbatim below so that a regression to a
// non-atomic or non-deleting script (e.g. GET without the DEL) fails the
// single-use tests instead of silently passing through an unconditioned mock.
const ATOMIC_GET_AND_DELETE_SCRIPT =
  "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value"

/**
 * In-memory stand-in for the Redis-backed transaction store. `set` honors NX
 * (refuses to overwrite an existing key). `eval` first verifies the caller is
 * still sending the known atomic GET-then-DEL Lua script against exactly one
 * key — a defense against the mock quietly validating a service that no
 * longer performs atomic single-use consumption — and only then reproduces
 * that script's real effect against the fake store.
 */
function installFakeTransactionStore(): Map<string, string> {
  const store = new Map<string, string>()

  mockSet.mockImplementation((key: string, value: string, _ex: string, _ttl: number, nx: string) => {
    if (nx === 'NX' && store.has(key)) return Promise.resolve(null)
    store.set(key, value)
    return Promise.resolve('OK')
  })

  mockEval.mockImplementation((script: string, numKeys: number, key: string) => {
    if (script !== ATOMIC_GET_AND_DELETE_SCRIPT || numKeys !== 1) {
      throw new Error(
        'mobile-federation.service.ts no envió el script Lua atómico GET+DEL de un solo uso esperado; '
        + 'la simulación de Redis no puede validar un contrato distinto al implementado.',
      )
    }

    const value = store.get(key)
    if (value !== undefined) store.delete(key)
    return Promise.resolve(value ?? null)
  })

  return store
}

describe('mobile-federation.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    installFakeTransactionStore()
  })

  describe('startMobileCtgOneFederation', () => {
    it('returns an https authorize URL carrying the PKCE challenge and a mobile-prefixed state', async () => {
      const result = await startMobileCtgOneFederation()

      expect(result.authorize_url.startsWith('https://')).toBe(true)
      const url = new URL(result.authorize_url)
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      expect(url.searchParams.get('state')).toBe(result.state)
      expect(result.state.startsWith('mobile-')).toBe(true)
      expect(result.callback_uri).toBe('vertice://auth/ctgone/callback')
      expect(result.expires_in).toBe(10 * 60)
    })

    it('never leaks the PKCE code_verifier to the caller', async () => {
      const result = await startMobileCtgOneFederation() as Record<string, unknown>

      expect(result.code_verifier).toBeUndefined()
      expect(result.verifier).toBeUndefined()
      expect(JSON.stringify(result)).not.toMatch(/verifier/i)
    })

    it('rejects the start when the transaction store refuses the write (id collision)', async () => {
      mockSet.mockResolvedValueOnce(null)

      await expect(startMobileCtgOneFederation()).rejects.toMatchObject({
        code: 'MOBILE_FEDERATION_TRANSACTION_UNAVAILABLE',
        statusCode: 503,
      })
    })
  })

  describe('exchangeMobileCtgOneFederation', () => {
    const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' }

    it('rejects an exchange for a transaction that was never started', async () => {
      await expect(
        exchangeMobileCtgOneFederation(
          {} as never,
          { code: 'abc', state: 'mobile-unknown', transaction_id: 'nonexistent' },
          meta,
        ),
      ).rejects.toMatchObject({
        code: 'MOBILE_FEDERATION_TRANSACTION_EXPIRED',
        statusCode: 401,
      })
      expect(mockExchange).not.toHaveBeenCalled()
    })

    it('rejects an exchange whose state does not match the one issued at start', async () => {
      const start = await startMobileCtgOneFederation()

      await expect(
        exchangeMobileCtgOneFederation(
          {} as never,
          { code: 'abc', state: 'mobile-forged', transaction_id: start.transaction_id },
          meta,
        ),
      ).rejects.toMatchObject({
        code: 'MOBILE_FEDERATION_STATE_MISMATCH',
        statusCode: 401,
      })
      expect(mockExchange).not.toHaveBeenCalled()
    })

    it('completes the exchange with the server-held code_verifier and never the raw code alone', async () => {
      const start = await startMobileCtgOneFederation()
      mockExchange.mockResolvedValueOnce({ access_token: 'tok', citizen_id: 'c1' })

      const result = await exchangeMobileCtgOneFederation(
        {} as never,
        { code: 'auth-code', state: start.state, transaction_id: start.transaction_id },
        meta,
      )

      expect(result).toEqual({ access_token: 'tok', citizen_id: 'c1' })
      expect(mockExchange).toHaveBeenCalledTimes(1)
      const [, exchangeInput] = mockExchange.mock.calls[0]
      expect(exchangeInput.code).toBe('auth-code')
      expect(exchangeInput.code_verifier).toEqual(expect.any(String))
      expect(exchangeInput.code_verifier.length).toBeGreaterThanOrEqual(43)
    })

    it('is single-use: a transaction cannot be replayed after a successful exchange', async () => {
      const start = await startMobileCtgOneFederation()
      mockExchange.mockResolvedValueOnce({ access_token: 'tok', citizen_id: 'c1' })

      await exchangeMobileCtgOneFederation(
        {} as never,
        { code: 'auth-code', state: start.state, transaction_id: start.transaction_id },
        meta,
      )

      await expect(
        exchangeMobileCtgOneFederation(
          {} as never,
          { code: 'auth-code', state: start.state, transaction_id: start.transaction_id },
          meta,
        ),
      ).rejects.toMatchObject({ code: 'MOBILE_FEDERATION_TRANSACTION_EXPIRED' })
      expect(mockExchange).toHaveBeenCalledTimes(1)
    })

    it('is single-use even when the replay is attempted after a failed downstream exchange', async () => {
      const start = await startMobileCtgOneFederation()
      mockExchange.mockRejectedValueOnce(Object.assign(new Error('bad code'), {
        statusCode: 401,
        code: 'INVALID_FEDERATION_CODE',
      }))

      await expect(
        exchangeMobileCtgOneFederation(
          {} as never,
          { code: 'auth-code', state: start.state, transaction_id: start.transaction_id },
          meta,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_FEDERATION_CODE' })

      await expect(
        exchangeMobileCtgOneFederation(
          {} as never,
          { code: 'auth-code', state: start.state, transaction_id: start.transaction_id },
          meta,
        ),
      ).rejects.toMatchObject({ code: 'MOBILE_FEDERATION_TRANSACTION_EXPIRED' })
    })
  })
})

import {
  normalizeRequestedIdempotencyKey,
  requestFingerprint,
} from '../idempotency'

describe('durable mutation idempotency contract', () => {
  it('canonicalizes object key order before fingerprinting', () => {
    const a = requestFingerprint('proposal:create', {
      title: 'Parque seguro',
      nested: { scope: 'neighborhood', votes: [1, 2, 3] },
    })
    const b = requestFingerprint('proposal:create', {
      nested: { votes: [1, 2, 3], scope: 'neighborhood' },
      title: 'Parque seguro',
    })

    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('separates operations by scope and payload', () => {
    const base = requestFingerprint('proposal:create', { title: 'A' })
    expect(requestFingerprint('proposal:create', { title: 'B' })).not.toBe(base)
    expect(requestFingerprint('report:create', { title: 'A' })).not.toBe(base)
  })

  it('accepts a bounded client idempotency key', () => {
    expect(normalizeRequestedIdempotencyKey(' civic-create:abc123 ')).toBe('civic-create:abc123')
  })

  it('rejects malformed or undersized keys before reserving a receipt', () => {
    expect(() => normalizeRequestedIdempotencyKey('short')).toThrow()
    try {
      normalizeRequestedIdempotencyKey('contains spaces and is invalid')
      throw new Error('expected INVALID_IDEMPOTENCY_KEY')
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
      })
    }
  })

  it('treats a missing header as an instruction to derive a privacy-safe key', () => {
    expect(normalizeRequestedIdempotencyKey(undefined)).toBeUndefined()
  })
})

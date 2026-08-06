import { hashToken, generateRefreshToken, refreshTokenExpiresAt } from '../jwt'

describe('hashToken', () => {
  it('returns a hex string of 64 characters', () => {
    const hash = hashToken('some-token')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashToken('tokenA')).not.toBe(hashToken('tokenB'))
  })
})

describe('generateRefreshToken', () => {
  it('returns a 80-character hex string (40 bytes)', () => {
    const token = generateRefreshToken()
    expect(token).toMatch(/^[0-9a-f]{80}$/)
  })

  it('generates unique tokens', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken())
  })
})

describe('refreshTokenExpiresAt', () => {
  it('returns a Date in the future', () => {
    const d = refreshTokenExpiresAt()
    expect(d).toBeInstanceOf(Date)
    expect(d.getTime()).toBeGreaterThan(Date.now())
  })
})

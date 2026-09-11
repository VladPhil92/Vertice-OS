import { PilotFeedbackSchema, PilotTelemetrySchema } from '../pilot.schema'
import {
  deployedPilotRevision,
  getPilotObservabilityState,
  pilotPseudonym,
  redactPilotText,
} from '../pilot.service'

describe('Phase 7I pilot operations privacy contract', () => {
  it('pseudonymizes citizen ids deterministically without exposing the source id', () => {
    const citizenId = '11111111-1111-4111-8111-111111111111'
    const pepper = 'p'.repeat(32)
    const first = pilotPseudonym(citizenId, pepper)
    const second = pilotPseudonym(citizenId, pepper)

    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{24}$/)
    expect(first).not.toContain(citizenId)
    expect(pilotPseudonym(citizenId, 'q'.repeat(32))).not.toBe(first)
  })

  it('redacts common personal identifiers from free-text feedback', () => {
    const value = redactPilotText(
      'Escríbeme a juan@example.com o +57 300 123 4567. Documento 123456789.',
    )

    expect(value).toContain('[redacted-email]')
    expect(value).toContain('[redacted-phone]')
    expect(value).toContain('[redacted-number]')
    expect(value).not.toContain('juan@example.com')
    expect(value).not.toContain('123456789')
  })

  it('requires a dedicated telemetry pepper with at least 32 characters', () => {
    expect(getPilotObservabilityState({}).configured).toBe(false)
    expect(getPilotObservabilityState({ PILOT_TELEMETRY_PEPPER: 'short' }).configured).toBe(false)
    expect(getPilotObservabilityState({ PILOT_TELEMETRY_PEPPER: 'x'.repeat(32) })).toEqual({
      configured: true,
      retention_days: 30,
      storage: 'redis_ephemeral',
    })
  })

  it('accepts only immutable full commit SHAs for operational evidence', () => {
    const sha = 'a'.repeat(40)
    expect(deployedPilotRevision({ RAILWAY_GIT_COMMIT_SHA: sha })).toBe(sha)

    for (const invalid of ['main', 'abc1234', '', 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40)]) {
      expect(deployedPilotRevision({ RAILWAY_GIT_COMMIT_SHA: invalid })).toBe('unknown')
    }
  })

  it('rejects arbitrary telemetry payload fields', () => {
    const parsed = PilotTelemetrySchema.safeParse({
      event: 'community_loaded',
      surface: 'community',
      outcome: 'success',
      platform: 'web',
      email: 'should-not-be-collected@example.com',
    })
    expect(parsed.success).toBe(false)
  })

  it('bounds feedback and rejects unknown fields that could smuggle raw context', () => {
    const parsed = PilotFeedbackSchema.safeParse({
      category: 'bug',
      rating: 3,
      surface: 'community',
      message: 'La pantalla se queda cargando después de abrir el feed.',
      context: { latitude: 10.4, longitude: -75.5 },
    })
    expect(parsed.success).toBe(false)

    expect(PilotFeedbackSchema.safeParse({
      category: 'bug',
      surface: 'community',
      message: 'x'.repeat(501),
    }).success).toBe(false)
  })
})

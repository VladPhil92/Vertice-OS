import {
  assessPilotActivationCurrent,
  pilotCohortFingerprint,
  type PilotActivationRecord,
} from '../pilot-activation.service'

const revision = 'a'.repeat(40)
const fingerprint = 'b'.repeat(24)

function context(overrides: Partial<{
  revision: string
  cohort_fingerprint: string | null
  cohort_size: number
  access_configured: boolean
  observability_configured: boolean
}> = {}) {
  return {
    revision,
    cohort_fingerprint: fingerprint,
    cohort_size: 12,
    access_configured: true,
    observability_configured: true,
    ...overrides,
  }
}

function record(overrides: Partial<PilotActivationRecord> = {}): PilotActivationRecord {
  return {
    state: 'active',
    revision,
    cohort_fingerprint: fingerprint,
    cohort_size: 12,
    changed_at: '2026-09-11T00:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 7L pilot activation policy', () => {
  it('accepts only an active record bound to the exact revision and cohort', () => {
    expect(assessPilotActivationCurrent(record(), context())).toMatchObject({
      state: 'active',
      current: true,
      blockers: [],
    })
  })

  it('fails closed after a deployment revision changes', () => {
    const state = assessPilotActivationCurrent(record(), context({ revision: 'c'.repeat(40) }))
    expect(state.current).toBe(false)
    expect(state.blockers).toContain('pilot:runtime_activation_revision_drift')
  })

  it('fails closed after the invited cohort changes', () => {
    const state = assessPilotActivationCurrent(
      record(),
      context({ cohort_fingerprint: 'd'.repeat(24), cohort_size: 13 }),
    )
    expect(state.current).toBe(false)
    expect(state.blockers).toEqual(expect.arrayContaining([
      'pilot:runtime_activation_cohort_drift',
      'pilot:runtime_activation_cohort_size_drift',
    ]))
  })

  it('keeps a paused cohort closed even when configuration is otherwise valid', () => {
    const state = assessPilotActivationCurrent(record({ state: 'paused' }), context())
    expect(state.current).toBe(false)
    expect(state.blockers).toContain('pilot:runtime_activation_paused')
  })

  it('fails closed when no activation record exists', () => {
    const state = assessPilotActivationCurrent(null, context())
    expect(state.current).toBe(false)
    expect(state.blockers).toContain('pilot:runtime_activation_missing')
  })

  it('uses a peppered cohort fingerprint that is order and case insensitive', () => {
    const envA = {
      PILOT_TELEMETRY_PEPPER: 'x'.repeat(32),
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'Pilot.One@example.com,pilot.two@example.com',
    }
    const envB = {
      PILOT_TELEMETRY_PEPPER: 'x'.repeat(32),
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'PILOT.TWO@example.com, pilot.one@example.com',
    }

    expect(pilotCohortFingerprint(envA)).toBe(pilotCohortFingerprint(envB))
    expect(pilotCohortFingerprint(envA)).toMatch(/^[0-9a-f]{24}$/)
  })

  it('does not derive a cohort fingerprint without adequate privacy material', () => {
    expect(pilotCohortFingerprint({
      PILOT_TELEMETRY_PEPPER: 'short',
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'pilot@example.com',
    })).toBeNull()
  })
})

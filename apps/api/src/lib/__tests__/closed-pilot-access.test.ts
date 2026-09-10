import { assertClosedPilotEmailAllowed, getClosedPilotAccessState } from '../closed-pilot-access'

describe('Phase 7H closed pilot access control', () => {
  it('is disabled by default without exposing an accidental pilot cohort', () => {
    expect(getClosedPilotAccessState({})).toEqual({
      enabled: false,
      configured: false,
      mode: 'disabled',
      cohort_size: 0,
    })
  })

  it('normalizes and de-duplicates the invite allowlist', () => {
    const env = {
      CLOSED_PILOT_MODE: 'true',
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'Pilot@Example.com, pilot@example.com, second@example.com',
    }

    expect(getClosedPilotAccessState(env)).toEqual({
      enabled: true,
      configured: true,
      mode: 'closed_invite_only',
      cohort_size: 2,
    })
    expect(() => assertClosedPilotEmailAllowed('PILOT@example.com', env)).not.toThrow()
  })

  it('rejects non-invited identities while pilot mode is enabled', () => {
    const env = {
      CLOSED_PILOT_MODE: 'true',
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'invited@example.com',
    }

    try {
      assertClosedPilotEmailAllowed('outsider@example.com', env)
      throw new Error('expected closed-pilot access rejection')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CLOSED_PILOT_INVITE_REQUIRED',
        statusCode: 403,
      })
    }
  })

  it.each([null, undefined, ''])('rejects a missing legacy email while pilot mode is enabled: %p', (email) => {
    const env = {
      CLOSED_PILOT_MODE: 'true',
      CLOSED_PILOT_EMAIL_ALLOWLIST: 'invited@example.com',
    }

    expect(() => assertClosedPilotEmailAllowed(email, env)).toThrow(
      'Esta fase de VÉRTICE está disponible únicamente por invitación',
    )
  })

  it('keeps nullable legacy identities compatible while pilot mode is disabled', () => {
    expect(() => assertClosedPilotEmailAllowed(null, {})).not.toThrow()
  })

  it('fails closed when pilot mode is enabled with an empty or oversized cohort', () => {
    expect(getClosedPilotAccessState({ CLOSED_PILOT_MODE: 'true' }).configured).toBe(false)

    const oversized = Array.from({ length: 31 }, (_, index) => `pilot-${index}@example.com`).join(',')
    expect(getClosedPilotAccessState({
      CLOSED_PILOT_MODE: 'true',
      CLOSED_PILOT_EMAIL_ALLOWLIST: oversized,
    }).configured).toBe(false)
  })
})

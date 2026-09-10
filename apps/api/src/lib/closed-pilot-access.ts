export interface ClosedPilotAccessState {
  enabled: boolean
  configured: boolean
  mode: 'disabled' | 'closed_invite_only'
  cohort_size: number
}

const MAX_CLOSED_PILOT_COHORT = 30

type PilotEnvironment = {
  CLOSED_PILOT_MODE?: string
  CLOSED_PILOT_EMAIL_ALLOWLIST?: string
}

function normalizedAllowlist(env: PilotEnvironment): string[] {
  return Array.from(new Set(
    (env.CLOSED_PILOT_EMAIL_ALLOWLIST ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ))
}

export function getClosedPilotAccessState(
  env: PilotEnvironment = process.env,
): ClosedPilotAccessState {
  const enabled = env.CLOSED_PILOT_MODE === 'true'
  const cohortSize = normalizedAllowlist(env).length

  return {
    enabled,
    configured: enabled && cohortSize > 0 && cohortSize <= MAX_CLOSED_PILOT_COHORT,
    mode: enabled ? 'closed_invite_only' : 'disabled',
    cohort_size: cohortSize,
  }
}

/**
 * Enforces the Phase 7H invitation boundary at authentication entry points.
 * The allowlist remains operator configuration and is never emitted by health
 * endpoints; only its coarse configured state and size are observable.
 *
 * Legacy/federated database rows may contain a nullable email. That remains
 * compatible while pilot mode is disabled, but pilot mode fails closed because
 * a null/blank identity can never match the explicit invitation allowlist.
 */
export function assertClosedPilotEmailAllowed(
  email: string | null | undefined,
  env: PilotEnvironment = process.env,
): void {
  const state = getClosedPilotAccessState(env)
  if (!state.enabled) return

  const normalizedEmail = email?.trim().toLowerCase() ?? ''
  if (!state.configured || !normalizedAllowlist(env).includes(normalizedEmail)) {
    throw Object.assign(
      new Error('Esta fase de VÉRTICE está disponible únicamente por invitación'),
      { statusCode: 403, code: 'CLOSED_PILOT_INVITE_REQUIRED' },
    )
  }
}

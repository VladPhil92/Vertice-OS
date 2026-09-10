import type { FeatureCapabilities } from './feature-secrets'
import type { RuntimeDependencyChecks } from './runtime-readiness'

export interface ClosedPilotReadinessInput {
  checks: RuntimeDependencyChecks
  capabilities: FeatureCapabilities
  revision: string
  production: boolean
}

export interface ClosedPilotSafeguards {
  access: 'closed_invite_only'
  governance: 'consultative_only'
  monetary_operations: 'disabled'
  account_deletion: 'required'
  moderation: 'required'
}

export interface ClosedPilotReadinessAssessment {
  ready: boolean
  status: 'ready' | 'blocked'
  blockers: string[]
  safeguards: ClosedPilotSafeguards
}

const PILOT_DEPENDENCIES: ReadonlyArray<keyof RuntimeDependencyChecks> = [
  'database',
  'redis',
  'neo4j',
]

const MONETARY_CAPABILITIES: ReadonlyArray<keyof FeatureCapabilities> = [
  'payments',
  'crowdfunding_payments',
  'payouts',
  'crowdfunding_payouts',
]

export const CLOSED_PILOT_SAFEGUARDS: ClosedPilotSafeguards = {
  access: 'closed_invite_only',
  governance: 'consultative_only',
  monetary_operations: 'disabled',
  account_deletion: 'required',
  moderation: 'required',
}

/**
 * Phase 7H is intentionally stricter than generic serving readiness.
 *
 * The core API may keep serving safely when Neo4j is degraded, but the first
 * real-user pilot exercises Community/social graph behavior and therefore
 * requires Neo4j to be healthy. Likewise, real-money capabilities must remain
 * disabled until their separate external/provider certification is complete.
 *
 * This evaluator never grants market-release certification. It only establishes
 * whether an exact runtime is safe enough for a bounded, invite-only pilot.
 */
export function assessClosedPilotReadiness({
  checks,
  capabilities,
  revision,
  production,
}: ClosedPilotReadinessInput): ClosedPilotReadinessAssessment {
  const blockers: string[] = []

  for (const dependency of PILOT_DEPENDENCIES) {
    if (checks[dependency] !== 'ok') blockers.push(`dependency:${dependency}`)
  }

  for (const [capability, state] of Object.entries(capabilities)) {
    if (state === 'misconfigured') blockers.push(`capability:${capability}`)
  }

  for (const capability of MONETARY_CAPABILITIES) {
    if (capabilities[capability] !== 'disabled') {
      blockers.push(`pilot:monetary_capability:${capability}`)
    }
  }

  if (production && revision === 'unknown') blockers.push('runtime:revision_unknown')

  const uniqueBlockers = Array.from(new Set(blockers)).sort()
  const ready = uniqueBlockers.length === 0

  return {
    ready,
    status: ready ? 'ready' : 'blocked',
    blockers: uniqueBlockers,
    safeguards: CLOSED_PILOT_SAFEGUARDS,
  }
}

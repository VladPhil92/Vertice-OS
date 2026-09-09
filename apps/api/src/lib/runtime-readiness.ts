import type { FeatureCapabilities } from './feature-secrets'

export type DependencyState = 'ok' | 'fail'

export interface RuntimeDependencyChecks {
  redis: DependencyState
  database: DependencyState
  neo4j: DependencyState
}

export interface RuntimeReadinessAssessment {
  servingReady: boolean
  releaseReady: boolean
  status: 'ok' | 'degraded' | 'unavailable'
  blockers: string[]
}

export interface RuntimeReadinessInput {
  checks: RuntimeDependencyChecks
  capabilities: FeatureCapabilities
  revision: string
  production: boolean
}

const CORE_DEPENDENCIES: ReadonlyArray<keyof RuntimeDependencyChecks> = [
  'redis',
  'database',
]

const OPTIONAL_DEPENDENCIES: ReadonlyArray<keyof RuntimeDependencyChecks> = [
  'neo4j',
]

/**
 * Runtime policy used by both serving readiness and the stricter release gate.
 *
 * - Core dependency failures block traffic and releases.
 * - Optional dependency failures keep the API serving but mark it degraded.
 * - Disabled features are intentional and do not block a release.
 * - Partially configured features are ambiguous/unsafe and block a release.
 * - Production releases must expose an immutable deployment revision so runtime
 *   evidence can be tied to the exact source SHA being certified.
 */
export function assessRuntimeReadiness({
  checks,
  capabilities,
  revision,
  production,
}: RuntimeReadinessInput): RuntimeReadinessAssessment {
  const coreFailures = CORE_DEPENDENCIES.filter((dependency) => checks[dependency] !== 'ok')
  const optionalFailures = OPTIONAL_DEPENDENCIES.filter((dependency) => checks[dependency] !== 'ok')
  const misconfiguredCapabilities = Object.entries(capabilities)
    .filter(([, state]) => state === 'misconfigured')
    .map(([capability]) => capability)
    .sort()

  const blockers = [
    ...coreFailures.map((dependency) => `dependency:${dependency}`),
    ...misconfiguredCapabilities.map((capability) => `capability:${capability}`),
    ...(production && revision === 'unknown' ? ['runtime:revision_unknown'] : []),
  ]

  const servingReady = coreFailures.length === 0
  const releaseReady = servingReady && blockers.length === 0
  const degraded = optionalFailures.length > 0 || misconfiguredCapabilities.length > 0

  return {
    servingReady,
    releaseReady,
    status: servingReady ? (degraded ? 'degraded' : 'ok') : 'unavailable',
    blockers,
  }
}

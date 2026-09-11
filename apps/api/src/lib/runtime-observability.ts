import type { DependencyState, RuntimeDependencyChecks } from './runtime-readiness'

export type RuntimeDependencyName = keyof RuntimeDependencyChecks
export type DependencyPreviousState = DependencyState | 'unknown'

export interface DependencyProbeDetail {
  state: DependencyState
  latency_ms: number
  failure_code?: 'timeout' | 'unavailable'
}

export type RuntimeDependencyDetails = Record<RuntimeDependencyName, DependencyProbeDetail>

export interface DependencyTransition {
  dependency: RuntimeDependencyName
  previous_state: DependencyPreviousState
  current_state: DependencyState
  latency_ms: number
  revision: string
}

export type DependencyTransitionSink = (transition: DependencyTransition) => void

/**
 * Keeps health probing observable without turning scheduler traffic into a log
 * storm. A transition is emitted only when a dependency first becomes known or
 * changes state. Stable repeated probes remain silent.
 */
export function createDependencyTransitionTracker(
  revision: string,
  sink: DependencyTransitionSink,
) {
  const previous = new Map<RuntimeDependencyName, DependencyState>()

  return {
    observe(details: RuntimeDependencyDetails): void {
      for (const dependency of Object.keys(details) as RuntimeDependencyName[]) {
        const detail = details[dependency]
        const previousState = previous.get(dependency)

        if (previousState === detail.state) continue

        sink({
          dependency,
          previous_state: previousState ?? 'unknown',
          current_state: detail.state,
          latency_ms: detail.latency_ms,
          revision,
        })
        previous.set(dependency, detail.state)
      }
    },
  }
}

export interface OperationalAssessment {
  operational: boolean
  status: 'operational' | 'degraded' | 'unavailable'
  blockers: string[]
}

/**
 * Strict operator-facing health policy. Unlike serving readiness, every
 * runtime dependency must be healthy. Release blockers are also inherited so
 * this endpoint can be used as a promotion/canary signal without changing the
 * scheduler-safe /health/ready contract.
 */
export function assessOperationalHealth(
  checks: RuntimeDependencyChecks,
  servingReady: boolean,
  releaseBlockers: string[],
): OperationalAssessment {
  const dependencyBlockers = (Object.entries(checks) as Array<[
    RuntimeDependencyName,
    DependencyState,
  ]>)
    .filter(([, state]) => state !== 'ok')
    .map(([dependency]) => `dependency:${dependency}`)

  const blockers = [...new Set([...dependencyBlockers, ...releaseBlockers])].sort()
  const operational = blockers.length === 0

  return {
    operational,
    status: operational ? 'operational' : servingReady ? 'degraded' : 'unavailable',
    blockers,
  }
}

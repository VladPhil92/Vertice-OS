import { redis } from './redis'
import { prisma } from './prisma'
import { getNeo4jDriver } from './neo4j'
import type { RuntimeDependencyChecks } from './runtime-readiness'
import type { DependencyProbeDetail, RuntimeDependencyDetails } from './runtime-observability'

export const DEFAULT_DEPENDENCY_PROBE_TIMEOUT_MS = 2500

async function withTimeout<T>(
  label: string,
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} probe timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  try {
    return await Promise.race([work, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function measureProbe(
  label: string,
  work: Promise<unknown>,
  timeoutMs: number,
): Promise<DependencyProbeDetail> {
  const startedAt = Date.now()

  try {
    await withTimeout(label, work, timeoutMs)
    return { state: 'ok', latency_ms: Date.now() - startedAt }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'fail',
      latency_ms: Date.now() - startedAt,
      failure_code: message.includes('timed out') ? 'timeout' : 'unavailable',
    }
  }
}

/**
 * Bounded dependency probe for the Phase 7L activation control plane. It
 * deliberately mirrors the 2.5s production health contract so activation can
 * never ignore a dependency that /health/pilot treats as mandatory.
 */
export async function probeRuntimeDependencies(
  timeoutMs = DEFAULT_DEPENDENCY_PROBE_TIMEOUT_MS,
): Promise<{
  checks: RuntimeDependencyChecks
  dependencies: RuntimeDependencyDetails
}> {
  const [redisDetail, databaseDetail, neo4jDetail] = await Promise.all([
    measureProbe('redis', redis.ping(), timeoutMs),
    measureProbe('database', prisma.$queryRaw`SELECT 1`, timeoutMs),
    measureProbe('neo4j', getNeo4jDriver().verifyConnectivity(), timeoutMs),
  ])

  const dependencies: RuntimeDependencyDetails = {
    redis: redisDetail,
    database: databaseDetail,
    neo4j: neo4jDetail,
  }

  return {
    dependencies,
    checks: {
      redis: redisDetail.state,
      database: databaseDetail.state,
      neo4j: neo4jDetail.state,
    },
  }
}

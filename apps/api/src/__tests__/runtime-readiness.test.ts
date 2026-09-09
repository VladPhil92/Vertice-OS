import type { FeatureCapabilities } from '../lib/feature-secrets'
import { assessRuntimeReadiness, type RuntimeDependencyChecks } from '../lib/runtime-readiness'

const healthyChecks: RuntimeDependencyChecks = {
  redis: 'ok',
  database: 'ok',
  neo4j: 'ok',
}

const disabledCapabilities: FeatureCapabilities = {
  civic_ai: 'disabled',
  voting_crypto: 'disabled',
  identity_crypto: 'disabled',
  ctg_one_federation: 'disabled',
  civic_identity_assurance: 'disabled',
  civic_identity_proofing_ingress: 'disabled',
  payments: 'disabled',
  crowdfunding_payments: 'disabled',
  payouts: 'disabled',
  crowdfunding_payouts: 'disabled',
  civic_sbt: 'disabled',
  voting_registry: 'disabled',
}

describe('assessRuntimeReadiness', () => {
  it('allows serving and release when core dependencies are healthy and features are intentionally disabled', () => {
    const result = assessRuntimeReadiness({
      checks: healthyChecks,
      capabilities: disabledCapabilities,
      revision: 'abc123',
      production: true,
    })

    expect(result).toEqual({
      servingReady: true,
      releaseReady: true,
      status: 'ok',
      blockers: [],
    })
  })

  it('keeps serving when optional Neo4j is unavailable without manufacturing a release blocker', () => {
    const result = assessRuntimeReadiness({
      checks: { ...healthyChecks, neo4j: 'fail' },
      capabilities: disabledCapabilities,
      revision: 'abc123',
      production: true,
    })

    expect(result.servingReady).toBe(true)
    expect(result.releaseReady).toBe(true)
    expect(result.status).toBe('degraded')
    expect(result.blockers).toEqual([])
  })

  it('blocks serving and release when a core dependency fails', () => {
    const result = assessRuntimeReadiness({
      checks: { ...healthyChecks, database: 'fail' },
      capabilities: disabledCapabilities,
      revision: 'abc123',
      production: true,
    })

    expect(result.servingReady).toBe(false)
    expect(result.releaseReady).toBe(false)
    expect(result.status).toBe('unavailable')
    expect(result.blockers).toContain('dependency:database')
  })

  it('keeps civic serving available but blocks promotion for partially configured capabilities', () => {
    const result = assessRuntimeReadiness({
      checks: healthyChecks,
      capabilities: { ...disabledCapabilities, crowdfunding_payments: 'misconfigured' },
      revision: 'abc123',
      production: true,
    })

    expect(result.servingReady).toBe(true)
    expect(result.releaseReady).toBe(false)
    expect(result.status).toBe('degraded')
    expect(result.blockers).toEqual(['capability:crowdfunding_payments'])
  })

  it('requires an immutable revision for production promotion', () => {
    const result = assessRuntimeReadiness({
      checks: healthyChecks,
      capabilities: disabledCapabilities,
      revision: 'unknown',
      production: true,
    })

    expect(result.servingReady).toBe(true)
    expect(result.releaseReady).toBe(false)
    expect(result.blockers).toEqual(['runtime:revision_unknown'])
  })

  it('does not require a deployment revision outside production', () => {
    const result = assessRuntimeReadiness({
      checks: healthyChecks,
      capabilities: disabledCapabilities,
      revision: 'unknown',
      production: false,
    })

    expect(result.releaseReady).toBe(true)
    expect(result.blockers).toEqual([])
  })
})

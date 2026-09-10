import type { FeatureCapabilities } from '../feature-secrets'
import { assessClosedPilotReadiness } from '../closed-pilot-readiness'

const READY_CAPABILITIES: FeatureCapabilities = {
  civic_ai: 'ready',
  voting_crypto: 'ready',
  identity_crypto: 'ready',
  ctg_one_federation: 'ready',
  civic_identity_assurance: 'disabled',
  civic_identity_proofing_ingress: 'disabled',
  payments: 'disabled',
  crowdfunding_payments: 'disabled',
  payouts: 'disabled',
  crowdfunding_payouts: 'disabled',
  civic_sbt: 'disabled',
  voting_registry: 'disabled',
}

const HEALTHY_CHECKS = {
  database: 'ok' as const,
  redis: 'ok' as const,
  neo4j: 'ok' as const,
}

const READY_ACCESS = {
  enabled: true,
  configured: true,
  mode: 'closed_invite_only' as const,
  cohort_size: 10,
}

function capabilities(overrides: Partial<FeatureCapabilities> = {}): FeatureCapabilities {
  return { ...READY_CAPABILITIES, ...overrides }
}

describe('Phase 7H closed pilot readiness', () => {
  it('allows a bounded pilot when runtime, access and monetary safeguards are satisfied', () => {
    const result = assessClosedPilotReadiness({
      checks: HEALTHY_CHECKS,
      capabilities: capabilities(),
      access: READY_ACCESS,
      revision: 'a'.repeat(40),
      production: true,
    })

    expect(result).toEqual({
      ready: true,
      status: 'ready',
      blockers: [],
      safeguards: {
        access: 'closed_invite_only',
        governance: 'consultative_only',
        monetary_operations: 'disabled',
        account_deletion: 'required',
        moderation: 'required',
      },
    })
  })

  it('blocks a pilot until invite-only access is actually enabled and configured', () => {
    const result = assessClosedPilotReadiness({
      checks: HEALTHY_CHECKS,
      capabilities: capabilities(),
      access: { enabled: false, configured: false, mode: 'disabled', cohort_size: 0 },
      revision: 'b'.repeat(40),
      production: true,
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('pilot:access_control_not_ready')
  })

  it('treats Neo4j as mandatory for the Community/social-graph pilot', () => {
    const result = assessClosedPilotReadiness({
      checks: { ...HEALTHY_CHECKS, neo4j: 'fail' },
      capabilities: capabilities(),
      access: READY_ACCESS,
      revision: 'c'.repeat(40),
      production: true,
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('dependency:neo4j')
  })

  it.each([
    'payments',
    'crowdfunding_payments',
    'payouts',
    'crowdfunding_payouts',
  ] as const)('blocks the first pilot when %s is enabled', (capability) => {
    const result = assessClosedPilotReadiness({
      checks: HEALTHY_CHECKS,
      capabilities: capabilities({ [capability]: 'ready' }),
      access: READY_ACCESS,
      revision: 'd'.repeat(40),
      production: true,
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain(`pilot:monetary_capability:${capability}`)
  })

  it('blocks ambiguous feature configuration instead of silently piloting it', () => {
    const result = assessClosedPilotReadiness({
      checks: HEALTHY_CHECKS,
      capabilities: capabilities({ civic_identity_assurance: 'misconfigured' }),
      access: READY_ACCESS,
      revision: 'e'.repeat(40),
      production: true,
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('capability:civic_identity_assurance')
  })

  it('requires an immutable production revision', () => {
    const result = assessClosedPilotReadiness({
      checks: HEALTHY_CHECKS,
      capabilities: capabilities(),
      access: READY_ACCESS,
      revision: 'unknown',
      production: true,
    })

    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('runtime:revision_unknown')
  })
})

import {
  evaluateTerritorialAssuranceCertification,
  TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS,
  type TerritorialAssuranceExternalEvidence,
} from '../territory-assurance-certification'

const SHA = '0123456789abcdef0123456789abcdef01234567'
const OBSERVED_AT = '2026-09-10T18:00:00.000Z'

function completeEvidence(overrides: Partial<TerritorialAssuranceExternalEvidence> = {}): TerritorialAssuranceExternalEvidence {
  const scenarios = Object.fromEntries(
    TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS.map((scenario) => [scenario, {
      passed: true,
      evidence_reference: `audit:scenario/${scenario}`,
      observed_at: OBSERVED_AT,
    }]),
  ) as TerritorialAssuranceExternalEvidence['adversarial_scenarios']

  return {
    candidate_sha: SHA,
    provider: {
      provider_name: 'certified-test-provider',
      evidence_bundle_reference: 'audit:provider/bundle-001',
      evidence_reference_only: true,
      raw_document_storage_disabled: true,
      decision_authenticity_verified: true,
      replay_protection_verified: true,
      production_canary_passed: true,
    },
    operator: {
      evidence_bundle_reference: 'audit:operator/bundle-001',
      reviewer_separation_verified: true,
      revocation_drill_passed: true,
      audit_export_verified: true,
      incident_runbook_approved: true,
    },
    election_policy: {
      approval_reference: 'policy:territorial-election/approval-001',
      legal_privacy_review_approved: true,
      eligibility_policy_approved: true,
      policy_owner: 'Election Policy Owner',
      approved_at: OBSERVED_AT,
    },
    adversarial_scenarios: scenarios,
    ...overrides,
  }
}

describe('Phase 7G.4 territorial assurance certification', () => {
  test('repository readiness alone can never self-certify a production election', () => {
    const result = evaluateTerritorialAssuranceCertification({ candidateSha: SHA, repositoryContractReady: true })

    expect(result.repository_contract_ready).toBe(true)
    expect(result.production_election_certified).toBe(false)
    expect(result.boundary).toBe('EXTERNAL_EVIDENCE_REQUIRED')
    expect(result.blockers).toContain('external_evidence_missing')
  })

  test('invalid candidate SHA is explicitly BLOCKED', () => {
    const result = evaluateTerritorialAssuranceCertification({ candidateSha: 'main', repositoryContractReady: true })

    expect(result.repository_contract_ready).toBe(false)
    expect(result.production_election_certified).toBe(false)
    expect(result.boundary).toBe('BLOCKED')
    expect(result.blockers).toContain('candidate_sha_invalid')
  })

  test('failed repository contract remains BLOCKED even with complete external assertions', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: false,
      externalEvidence: completeEvidence(),
    })

    expect(result.repository_contract_ready).toBe(false)
    expect(result.production_election_certified).toBe(false)
    expect(result.boundary).toBe('BLOCKED')
    expect(result.blockers).toContain('repository_contract_not_ready')
  })

  test('fails closed when external evidence belongs to a different SHA', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: completeEvidence({ candidate_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toContain('external_evidence_sha_mismatch')
  })

  test('requires provider, operator and policy evidence references in addition to boolean assertions', () => {
    const evidence = completeEvidence()
    evidence.provider.evidence_bundle_reference = 'TBD'
    evidence.operator.evidence_bundle_reference = ''
    evidence.election_policy.approval_reference = 'REPLACE_WITH_APPROVAL'

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'provider_evidence_reference_missing',
      'operator_evidence_reference_missing',
      'policy_approval_reference_missing',
    ]))
  })

  test('requires every adversarial scenario and its traceable observation', () => {
    const evidence = completeEvidence()
    evidence.adversarial_scenarios.scope_mismatch_rejected = {
      passed: false,
      evidence_reference: 'audit:scenario/scope-mismatch',
      observed_at: OBSERVED_AT,
    }
    evidence.adversarial_scenarios.payments_cannot_grant_residence = {
      passed: true,
      evidence_reference: 'TBD',
      observed_at: 'not-a-date',
    }

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'adversarial_scenario_missing:scope_mismatch_rejected',
      'adversarial_evidence_reference_missing:payments_cannot_grant_residence',
      'adversarial_evidence_timestamp_invalid:payments_cannot_grant_residence',
    ]))
  })

  test('requires provider authenticity, replay protection and a production canary', () => {
    const evidence = completeEvidence()
    evidence.provider.decision_authenticity_verified = false
    evidence.provider.replay_protection_verified = false
    evidence.provider.production_canary_passed = false

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'provider_decision_authenticity_not_verified',
      'provider_replay_protection_not_verified',
      'provider_production_canary_missing',
    ]))
  })

  test('requires reviewer separation, revocation drill and auditability', () => {
    const evidence = completeEvidence()
    evidence.operator.reviewer_separation_verified = false
    evidence.operator.revocation_drill_passed = false
    evidence.operator.audit_export_verified = false

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'reviewer_separation_not_verified',
      'revocation_drill_missing',
      'audit_export_not_verified',
    ]))
  })

  test('requires explicit legal/privacy and election eligibility policy approval', () => {
    const evidence = completeEvidence()
    evidence.election_policy.legal_privacy_review_approved = false
    evidence.election_policy.eligibility_policy_approved = false
    evidence.election_policy.policy_owner = ''

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'legal_privacy_review_missing',
      'eligibility_policy_approval_missing',
      'policy_owner_missing',
    ]))
  })

  test('certifies only when repository and exact-SHA traceable external evidence are complete', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: completeEvidence(),
    })

    expect(result.blockers).toEqual([])
    expect(result.repository_contract_ready).toBe(true)
    expect(result.production_election_certified).toBe(true)
    expect(result.boundary).toBe('PRODUCTION_ELECTION_CERTIFIED')
  })
})

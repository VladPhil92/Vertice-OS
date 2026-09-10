import {
  evaluateTerritorialAssuranceCertification,
  TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS,
  type TerritorialAssuranceExternalEvidence,
} from '../territory-assurance-certification'

const SHA = '0123456789abcdef0123456789abcdef01234567'

function completeEvidence(overrides: Partial<TerritorialAssuranceExternalEvidence> = {}): TerritorialAssuranceExternalEvidence {
  const scenarios = Object.fromEntries(
    TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS.map((scenario) => [scenario, true]),
  ) as TerritorialAssuranceExternalEvidence['adversarial_scenarios']

  return {
    candidate_sha: SHA,
    provider: {
      provider_name: 'certified-test-provider',
      evidence_reference_only: true,
      raw_document_storage_disabled: true,
      decision_authenticity_verified: true,
      replay_protection_verified: true,
      production_canary_passed: true,
    },
    operator: {
      reviewer_separation_verified: true,
      revocation_drill_passed: true,
      audit_export_verified: true,
      incident_runbook_approved: true,
    },
    election_policy: {
      legal_privacy_review_approved: true,
      eligibility_policy_approved: true,
      policy_owner: 'Election Policy Owner',
      approved_at: '2026-09-10T18:00:00.000Z',
    },
    adversarial_scenarios: scenarios,
    ...overrides,
  }
}

describe('Phase 7G.4 territorial assurance certification', () => {
  test('repository readiness alone can never self-certify a production election', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
    })

    expect(result.repository_contract_ready).toBe(true)
    expect(result.production_election_certified).toBe(false)
    expect(result.boundary).toBe('EXTERNAL_EVIDENCE_REQUIRED')
    expect(result.blockers).toContain('external_evidence_missing')
  })

  test('fails closed when external evidence belongs to a different SHA', () => {
    const evidence = completeEvidence({
      candidate_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toContain('external_evidence_sha_mismatch')
  })

  test('requires every adversarial assurance scenario', () => {
    const evidence = completeEvidence()
    evidence.adversarial_scenarios.scope_mismatch_rejected = false
    evidence.adversarial_scenarios.payments_cannot_grant_residence = false

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      repositoryContractReady: true,
      externalEvidence: evidence,
    })

    expect(result.production_election_certified).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      'adversarial_scenario_missing:scope_mismatch_rejected',
      'adversarial_scenario_missing:payments_cannot_grant_residence',
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

  test('certifies only when repository and exact-SHA external evidence are complete', () => {
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

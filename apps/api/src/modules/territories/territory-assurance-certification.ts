export const TERRITORIAL_ASSURANCE_CERTIFICATION_VERSION = '7G.4' as const

export const TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS = [
  'self_review_rejected',
  'expired_assurance_rejected',
  'territory_change_invalidates_assurance',
  'scope_mismatch_rejected',
  'renewal_does_not_rewrite_frozen_roll',
  'revocation_blocks_future_admission',
  'gps_cannot_grant_residence',
  'reputation_cannot_grant_residence',
  'payments_cannot_grant_residence',
  'identity_assurance_cannot_grant_residence',
] as const

export type TerritorialAssuranceScenario = typeof TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS[number]

export interface TerritorialAssuranceExternalEvidence {
  candidate_sha: string
  provider: {
    provider_name: string
    evidence_reference_only: boolean
    raw_document_storage_disabled: boolean
    decision_authenticity_verified: boolean
    replay_protection_verified: boolean
    production_canary_passed: boolean
  }
  operator: {
    reviewer_separation_verified: boolean
    revocation_drill_passed: boolean
    audit_export_verified: boolean
    incident_runbook_approved: boolean
  }
  election_policy: {
    legal_privacy_review_approved: boolean
    eligibility_policy_approved: boolean
    policy_owner: string
    approved_at: string
  }
  adversarial_scenarios: Partial<Record<TerritorialAssuranceScenario, boolean>>
}

export interface TerritorialAssuranceCertificationResult {
  certification_version: typeof TERRITORIAL_ASSURANCE_CERTIFICATION_VERSION
  candidate_sha: string
  repository_contract_ready: boolean
  production_election_certified: boolean
  blockers: string[]
  boundary: 'BLOCKED' | 'REPOSITORY_CONTRACT_READY' | 'EXTERNAL_EVIDENCE_REQUIRED' | 'PRODUCTION_ELECTION_CERTIFIED'
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0
}

function validIsoTimestamp(value: string): boolean {
  return nonEmpty(value) && Number.isFinite(Date.parse(value))
}

export function evaluateTerritorialAssuranceCertification(params: {
  candidateSha: string
  repositoryContractReady: boolean
  externalEvidence?: TerritorialAssuranceExternalEvidence | null
}): TerritorialAssuranceCertificationResult {
  const blockers: string[] = []
  const candidateSha = params.candidateSha.trim()

  if (!/^[0-9a-f]{40}$/i.test(candidateSha)) blockers.push('candidate_sha_invalid')
  if (!params.repositoryContractReady) blockers.push('repository_contract_not_ready')

  const repositoryReady = params.repositoryContractReady
    && !blockers.includes('candidate_sha_invalid')
    && !blockers.includes('repository_contract_not_ready')

  const evidence = params.externalEvidence
  if (!evidence) {
    return {
      certification_version: TERRITORIAL_ASSURANCE_CERTIFICATION_VERSION,
      candidate_sha: candidateSha,
      repository_contract_ready: repositoryReady,
      production_election_certified: false,
      blockers: [...blockers, 'external_evidence_missing'],
      boundary: repositoryReady ? 'EXTERNAL_EVIDENCE_REQUIRED' : 'BLOCKED',
    }
  }

  if (evidence.candidate_sha !== candidateSha) blockers.push('external_evidence_sha_mismatch')

  if (!nonEmpty(evidence.provider.provider_name)) blockers.push('provider_name_missing')
  if (!evidence.provider.evidence_reference_only) blockers.push('provider_raw_reference_boundary_not_proven')
  if (!evidence.provider.raw_document_storage_disabled) blockers.push('raw_document_storage_boundary_not_proven')
  if (!evidence.provider.decision_authenticity_verified) blockers.push('provider_decision_authenticity_not_verified')
  if (!evidence.provider.replay_protection_verified) blockers.push('provider_replay_protection_not_verified')
  if (!evidence.provider.production_canary_passed) blockers.push('provider_production_canary_missing')

  if (!evidence.operator.reviewer_separation_verified) blockers.push('reviewer_separation_not_verified')
  if (!evidence.operator.revocation_drill_passed) blockers.push('revocation_drill_missing')
  if (!evidence.operator.audit_export_verified) blockers.push('audit_export_not_verified')
  if (!evidence.operator.incident_runbook_approved) blockers.push('incident_runbook_not_approved')

  if (!evidence.election_policy.legal_privacy_review_approved) blockers.push('legal_privacy_review_missing')
  if (!evidence.election_policy.eligibility_policy_approved) blockers.push('eligibility_policy_approval_missing')
  if (!nonEmpty(evidence.election_policy.policy_owner)) blockers.push('policy_owner_missing')
  if (!validIsoTimestamp(evidence.election_policy.approved_at)) blockers.push('policy_approval_timestamp_invalid')

  for (const scenario of TERRITORIAL_ASSURANCE_REQUIRED_ADVERSARIAL_SCENARIOS) {
    if (evidence.adversarial_scenarios[scenario] !== true) {
      blockers.push(`adversarial_scenario_missing:${scenario}`)
    }
  }

  const productionCertified = repositoryReady && blockers.length === 0

  return {
    certification_version: TERRITORIAL_ASSURANCE_CERTIFICATION_VERSION,
    candidate_sha: candidateSha,
    repository_contract_ready: repositoryReady,
    production_election_certified: productionCertified,
    blockers,
    boundary: productionCertified
      ? 'PRODUCTION_ELECTION_CERTIFIED'
      : repositoryReady
        ? 'EXTERNAL_EVIDENCE_REQUIRED'
        : 'BLOCKED',
  }
}

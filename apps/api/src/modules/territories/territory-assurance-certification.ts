export const TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS = [
  'provider_production_canary',
  'operator_reviewer_separation',
  'privacy_legal_approval',
  'revocation_drill',
  'expiry_renewal_drill',
  'scope_mismatch_drill',
  'frozen_electorate_drill',
] as const

export type TerritorialAssuranceExternalControl = typeof TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS[number]

export type TerritorialAssuranceCertificationEvidence = Partial<Record<
  TerritorialAssuranceExternalControl,
  string
>>

export interface TerritorialAssuranceCertificationInput {
  candidateSha: string
  expectedSha: string
  evidence: TerritorialAssuranceCertificationEvidence
}

export type TerritorialAssuranceProductionReadiness =
  | 'blocked_external_evidence'
  | 'ready_for_operator_release_review'

export interface TerritorialAssuranceCertificationResult {
  exact_sha: boolean
  repository_contract: 'eligible_for_ci_certification' | 'blocked_sha_mismatch'
  production_readiness: TerritorialAssuranceProductionReadiness
  automatic_production_certification: false
  satisfied_controls: TerritorialAssuranceExternalControl[]
  missing_controls: TerritorialAssuranceExternalControl[]
  invalid_controls: TerritorialAssuranceExternalControl[]
  blocking_reasons: string[]
}

const SHA_PATTERN = /^[0-9a-f]{40}$/i
const OPAQUE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{15,255}$/

export function isOpaqueTerritorialCertificationReference(value: string): boolean {
  const trimmed = value.trim()
  return OPAQUE_REFERENCE_PATTERN.test(trimmed) && !/^https?:\/\//i.test(trimmed)
}

/**
 * Phase 7G.4 deliberately separates repository certification from production
 * release authority. CI can prove that the candidate SHA preserves the code,
 * database and election-boundary contracts. It cannot fabricate provider,
 * operator or legal evidence.
 *
 * Even with a complete evidence bundle this function returns
 * `ready_for_operator_release_review`, never `certified`.
 */
export function evaluateTerritorialAssuranceCertification(
  input: TerritorialAssuranceCertificationInput,
): TerritorialAssuranceCertificationResult {
  const exactSha = SHA_PATTERN.test(input.candidateSha)
    && SHA_PATTERN.test(input.expectedSha)
    && input.candidateSha.toLowerCase() === input.expectedSha.toLowerCase()

  const satisfiedControls: TerritorialAssuranceExternalControl[] = []
  const missingControls: TerritorialAssuranceExternalControl[] = []
  const invalidControls: TerritorialAssuranceExternalControl[] = []

  for (const control of TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS) {
    const reference = input.evidence[control]
    if (!reference) {
      missingControls.push(control)
      continue
    }
    if (!isOpaqueTerritorialCertificationReference(reference)) {
      invalidControls.push(control)
      continue
    }
    satisfiedControls.push(control)
  }

  const blockingReasons: string[] = []
  if (!exactSha) blockingReasons.push('candidate_sha_mismatch')
  if (missingControls.length > 0) blockingReasons.push('external_evidence_missing')
  if (invalidControls.length > 0) blockingReasons.push('external_evidence_reference_invalid')

  return {
    exact_sha: exactSha,
    repository_contract: exactSha ? 'eligible_for_ci_certification' : 'blocked_sha_mismatch',
    production_readiness: exactSha && missingControls.length === 0 && invalidControls.length === 0
      ? 'ready_for_operator_release_review'
      : 'blocked_external_evidence',
    automatic_production_certification: false,
    satisfied_controls: satisfiedControls,
    missing_controls: missingControls,
    invalid_controls: invalidControls,
    blocking_reasons: blockingReasons,
  }
}

import {
  TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS,
  evaluateTerritorialAssuranceCertification,
  isOpaqueTerritorialCertificationReference,
  type TerritorialAssuranceCertificationEvidence,
} from './territory-assurance-certification'

const SHA = '3da292ba3c444997fcf8d37c71836acdc8c7e1d7'

function completeEvidence(): TerritorialAssuranceCertificationEvidence {
  return Object.fromEntries(
    TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS.map((control) => [
      control,
      `vault:territory-cert/${control}/evidence-20260910`,
    ]),
  ) as TerritorialAssuranceCertificationEvidence
}

describe('Phase 7G.4 territorial assurance certification policy', () => {
  it('blocks certification when the tested SHA is not the submitted candidate', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      expectedSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      evidence: completeEvidence(),
    })

    expect(result).toMatchObject({
      exact_sha: false,
      repository_contract: 'blocked_sha_mismatch',
      production_readiness: 'blocked_external_evidence',
      automatic_production_certification: false,
    })
    expect(result.blocking_reasons).toContain('candidate_sha_mismatch')
  })

  it('keeps production blocked when external evidence is absent', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      expectedSha: SHA,
      evidence: {},
    })

    expect(result.exact_sha).toBe(true)
    expect(result.repository_contract).toBe('eligible_for_ci_certification')
    expect(result.production_readiness).toBe('blocked_external_evidence')
    expect(result.missing_controls).toEqual(TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS)
    expect(result.blocking_reasons).toContain('external_evidence_missing')
  })

  it('rejects HTTP evidence links instead of treating signed/public URLs as certification evidence', () => {
    const evidence = completeEvidence()
    evidence.provider_production_canary = 'https://provider.example/canary?id=secret'

    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      expectedSha: SHA,
      evidence,
    })

    expect(result.invalid_controls).toEqual(['provider_production_canary'])
    expect(result.production_readiness).toBe('blocked_external_evidence')
    expect(result.blocking_reasons).toContain('external_evidence_reference_invalid')
  })

  it('accepts opaque evidence references without automatically certifying production', () => {
    const result = evaluateTerritorialAssuranceCertification({
      candidateSha: SHA,
      expectedSha: SHA,
      evidence: completeEvidence(),
    })

    expect(result).toMatchObject({
      exact_sha: true,
      repository_contract: 'eligible_for_ci_certification',
      production_readiness: 'ready_for_operator_release_review',
      automatic_production_certification: false,
      missing_controls: [],
      invalid_controls: [],
      blocking_reasons: [],
    })
    expect(result.satisfied_controls).toEqual(TERRITORIAL_ASSURANCE_EXTERNAL_CONTROLS)
  })

  it('defines certification evidence as opaque references only', () => {
    expect(isOpaqueTerritorialCertificationReference('vault:territory-cert/provider/canary-001')).toBe(true)
    expect(isOpaqueTerritorialCertificationReference('https://example.com/evidence')).toBe(false)
    expect(isOpaqueTerritorialCertificationReference('short')).toBe(false)
    expect(isOpaqueTerritorialCertificationReference('contains spaces and raw data')).toBe(false)
  })
})

import {
  validateExternalProviderCertificationEvidence,
  type NativeProviderCertificationEventRow,
} from '../identity-provider-external-certification.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROVIDER_REFERENCE = 'end-user:550e8400-e29b-41d4-a716-446655440000'

function event(
  status: 'verified' | 'revoked' | 'expired',
  minute: number,
  overrides: Partial<NativeProviderCertificationEventRow> = {},
): NativeProviderCertificationEventRow {
  const occurredAt = new Date(`2026-09-04T20:${String(minute).padStart(2, '0')}:00.000Z`)
  return {
    provider: 'veriff',
    event_id: `veriff:attempt:${status}:${minute}`,
    citizen_id: CITIZEN_ID,
    provider_reference: PROVIDER_REFERENCE,
    status,
    assurance_level: status === 'verified' ? 2 : 0,
    evidence_hash: 'a'.repeat(64),
    occurred_at: occurredAt,
    ingress_signature_version: 2,
    ingress_signed_at: occurredAt,
    ...overrides,
  }
}

describe('P1.0 external provider certification evidence', () => {
  it('produces deterministic PII-free commitments from a native lifecycle canary', () => {
    const rows = [event('verified', 1), event('revoked', 2), event('expired', 3)]

    const first = validateExternalProviderCertificationEvidence(' Veriff ', rows)
    const second = validateExternalProviderCertificationEvidence('veriff', rows)

    expect(first).toEqual(second)
    expect(first.provider).toBe('veriff')
    expect(first.contract_version).toBe(1)
    expect(first.evidence_digest).toMatch(/^[0-9a-f]{64}$/)
    expect(first.subject_binding_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(first.subject_binding_hash).not.toContain(CITIZEN_ID)
    expect(first.subject_binding_hash).not.toContain(PROVIDER_REFERENCE)
    expect(first).toMatchObject({
      verified_event_id: rows[0].event_id,
      revoked_event_id: rows[1].event_id,
      expired_event_id: rows[2].event_id,
    })
  })

  it('rejects a canary containing non-native ingress provenance', () => {
    const rows = [
      event('verified', 1),
      event('revoked', 2, { ingress_signature_version: 1 }),
      event('expired', 3),
    ]

    expect(() => validateExternalProviderCertificationEvidence('veriff', rows))
      .toThrow('procedencia nativa autenticada')
  })

  it('rejects subject switching across lifecycle events', () => {
    const rows = [
      event('verified', 1),
      event('revoked', 2, { provider_reference: 'end-user:other' }),
      event('expired', 3),
    ]

    expect(() => validateExternalProviderCertificationEvidence('veriff', rows))
      .toThrow('mismo sujeto')
  })

  it('rejects non-monotonic lifecycle evidence', () => {
    const rows = [event('verified', 3), event('revoked', 2), event('expired', 4)]

    expect(() => validateExternalProviderCertificationEvidence('veriff', rows))
      .toThrow('no es monotónico')
  })

  it('rejects incomplete lifecycle evidence', () => {
    const rows = [event('verified', 1), event('revoked', 2)]

    expect(() => validateExternalProviderCertificationEvidence('veriff', rows))
      .toThrow('exactamente tres eventos')
  })
})

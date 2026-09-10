import {
  CivicActionEvidenceSchema,
  CivicActionReviewSchema,
  CivicActionValidationSchema,
  CreateCivicActionSchema,
  UpdateCivicActionSchema,
} from '../civic-actions.schema'

describe('civic action contracts', () => {
  it('does not allow an action owner to self-promote a result to verified', () => {
    const parsed = UpdateCivicActionSchema.safeParse({ status: 'verified' })
    expect(parsed.success).toBe(false)
  })

  it('allows a citizen to target a Colombian municipality independently from home', () => {
    const parsed = CreateCivicActionSchema.parse({
      title: 'Recuperar parque del barrio',
      problem: 'El parque presenta deterioro y falta de mantenimiento comunitario.',
      objective: 'Organizar una jornada verificable de recuperación del espacio.',
      category: 'Espacio público',
      territory_code: 'CO-MP-05001',
      territory_source: 'manual',
    })
    expect(parsed.territory_code).toBe('CO-MP-05001')
  })

  it('does not accept territory provenance without an explicit target', () => {
    expect(CreateCivicActionSchema.safeParse({
      title: 'Recuperar parque del barrio',
      problem: 'El parque presenta deterioro y falta de mantenimiento comunitario.',
      objective: 'Organizar una jornada verificable de recuperación del espacio.',
      category: 'Espacio público',
      territory_source: 'gps',
    }).success).toBe(false)
  })

  it('keeps territory immutable through the owner update contract', () => {
    expect(UpdateCivicActionSchema.safeParse({ territory_code: 'CO-MP-76001' }).success).toBe(false)
  })

  it('requires an external source URL for external evidence', () => {
    const parsed = CivicActionEvidenceSchema.safeParse({
      evidence_type: 'external_record',
      evidence_url: 'https://example.com/evidence.pdf',
    })
    expect(parsed.success).toBe(false)
  })

  it('normalizes SHA-256 evidence hashes', () => {
    const parsed = CivicActionEvidenceSchema.parse({
      evidence_type: 'document',
      evidence_url: 'https://example.com/evidence.pdf',
      content_hash: 'A'.repeat(64),
    })
    expect(parsed.content_hash).toBe('a'.repeat(64))
  })

  it('requires an explanation when disputing evidence', () => {
    expect(CivicActionValidationSchema.safeParse({
      stance: 'dispute',
      note: 'muy corta',
    }).success).toBe(false)
  })

  it('requires moderator justification for no-evidence decisions', () => {
    expect(CivicActionReviewSchema.safeParse({
      decision: 'no_evidence',
      note: 'corta',
    }).success).toBe(false)
  })
})

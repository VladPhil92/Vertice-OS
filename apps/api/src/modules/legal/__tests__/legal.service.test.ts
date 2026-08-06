const mockQueryRaw = jest.fn()
const mockGetCache = jest.fn()
const mockSetCache = jest.fn()
const mockDelCache = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}))

jest.mock('../../../lib/cache', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
  delCache: mockDelCache,
  TTL: { PROFILE: 300, SESSION: 60, REPORT: 120, STATS: 600 },
}))

// Mock global fetch used by callLegalAI
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import {
  createLegalDocument,
  getLegalDocument,
  listLegalDocuments,
  updateLegalDocument,
  submitLegalDocument,
  deleteLegalDocument,
} from '../legal.service'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CITIZEN_ID  = '550e8400-e29b-41d4-a716-446655440001'
const DOCUMENT_ID = '660e8400-e29b-41d4-a716-446655440002'
const NOW         = new Date('2025-06-01T12:00:00Z')

const RAW_ROW = {
  id:                     DOCUMENT_ID,
  citizen_id:             CITIZEN_ID,
  legal_type:             'derecho_de_peticion',
  status:                 'draft',
  urgency:                'media',
  situation_description:  'Hay un hueco grande en la calle 34 que lleva meses sin reparación y ha causado accidentes.',
  evidence_description:   'Foto del hueco tomada el 1 de mayo',
  location:               'Calle 34 con Av. Blas de Lezo, Cartagena',
  evidence_urls:          '[]',
  rights_affected:        '["Derecho a la movilidad segura","Derecho a la integridad física"]',
  target_entity:          JSON.stringify({
    name:           'Secretaría Distrital de Infraestructura',
    type:           'distrital',
    address:        'Calle 36 No. 6-60',
    email:          'infraestructura@cartagena.gov.co',
    phone:          '(605) 650-5001',
    contact_person: 'Secretario de Infraestructura',
  }),
  response_deadline_days: BigInt(15),
  legal_basis:            '["Artículo 23 Constitución Política","Ley 1755 de 2015"]',
  alternative_remedies:   '["Acción popular si persiste el daño"]',
  next_steps:             '["Esperar respuesta en 15 días hábiles","Escalar a tutela si no responden"]',
  legal_orientation:      'Tiene derecho a exigir reparación inmediata del vía pública.',
  ai_audit_id:            'audit-abc-123',
  document_draft:         'Señor Secretario: Por medio del presente ...',
  submitted_at:           null,
  submitted_via:          null,
  entity_response:        null,
  entity_responded_at:    null,
  response_deadline_at:   null,
  created_at:             NOW,
  updated_at:             NOW,
}

const AI_RESPONSE = {
  legal_type:             'derecho_de_peticion',
  urgency:                'media',
  rights_affected:        ['Derecho a la movilidad segura', 'Derecho a la integridad física'],
  target_entity: {
    name:           'Secretaría Distrital de Infraestructura',
    type:           'distrital',
    address:        'Calle 36 No. 6-60',
    email:          'infraestructura@cartagena.gov.co',
    phone:          '(605) 650-5001',
    contact_person: 'Secretario de Infraestructura',
  },
  response_deadline_days: 15,
  document_draft:         'Señor Secretario: Por medio del presente ...',
  legal_orientation:      'Tiene derecho a exigir reparación inmediata del vía pública.',
  alternative_remedies:   ['Acción popular si persiste el daño'],
  legal_basis:            ['Artículo 23 Constitución Política', 'Ley 1755 de 2015'],
  next_steps:             ['Esperar respuesta en 15 días hábiles', 'Escalar a tutela si no responden'],
  audit_id:               'audit-abc-123',
}

const CREATE_INPUT = {
  situation_description: 'Hay un hueco grande en la calle 34 que lleva meses sin reparación y ha causado accidentes.',
  evidence_description:  'Foto del hueco tomada el 1 de mayo',
  location:              'Calle 34 con Av. Blas de Lezo, Cartagena',
  evidence_urls:         [] as string[],
  category:              'infraestructura',
}

beforeEach(() => {
  jest.resetAllMocks()
  mockGetCache.mockResolvedValue(null)
  mockSetCache.mockResolvedValue(undefined)
  mockDelCache.mockResolvedValue(undefined)
})

// ── createLegalDocument ───────────────────────────────────────────────────────

describe('createLegalDocument', () => {
  it('calls AI service and inserts document into DB', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValue(AI_RESPONSE),
    })
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    const doc = await createLegalDocument(CITIZEN_ID, CREATE_INPUT)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/legal/analyze'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(doc.legal_type).toBe('derecho_de_peticion')
    expect(doc.status).toBe('draft')
    expect(doc.citizen_id).toBe(CITIZEN_ID)
  })

  it('throws when AI service returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   false,
      status: 503,
      text: jest.fn().mockResolvedValue('Service unavailable'),
    })

    await expect(createLegalDocument(CITIZEN_ID, CREATE_INPUT))
      .rejects.toThrow('AI service error 503')
  })

  it('invalidates the list cache after creation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValue(AI_RESPONSE),
    })
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    await createLegalDocument(CITIZEN_ID, CREATE_INPUT)

    expect(mockDelCache).toHaveBeenCalledWith('legal:list', CITIZEN_ID)
  })

  it('normalizes JSONB fields and BigInt deadline', async () => {
    mockFetch.mockResolvedValueOnce({
      ok:   true,
      json: jest.fn().mockResolvedValue(AI_RESPONSE),
    })
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    const doc = await createLegalDocument(CITIZEN_ID, CREATE_INPUT)

    expect(Array.isArray(doc.rights_affected)).toBe(true)
    expect(doc.rights_affected).toContain('Derecho a la movilidad segura')
    expect(typeof doc.response_deadline_days).toBe('number')
    expect(doc.response_deadline_days).toBe(15)
    expect(doc.target_entity.name).toBe('Secretaría Distrital de Infraestructura')
  })
})

// ── getLegalDocument ──────────────────────────────────────────────────────────

describe('getLegalDocument', () => {
  it('returns cached document if citizen_id matches', async () => {
    const cachedDoc = { ...RAW_ROW, citizen_id: CITIZEN_ID, id: DOCUMENT_ID } as unknown
    mockGetCache.mockResolvedValueOnce(cachedDoc)

    const doc = await getLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(mockQueryRaw).not.toHaveBeenCalled()
    expect(doc?.id).toBe(DOCUMENT_ID)
  })

  it('ignores cache when citizen_id does not match (ownership check)', async () => {
    const cachedDoc = { citizen_id: 'different-citizen', id: DOCUMENT_ID }
    mockGetCache.mockResolvedValueOnce(cachedDoc)
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    const doc = await getLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(doc?.citizen_id).toBe(CITIZEN_ID)
  })

  it('returns null when document not found', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const doc = await getLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(doc).toBeNull()
  })

  it('sets cache after DB hit', async () => {
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    await getLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(mockSetCache).toHaveBeenCalledWith('legal:doc', DOCUMENT_ID, expect.any(Object), expect.any(Number))
  })
})

// ── listLegalDocuments ────────────────────────────────────────────────────────

describe('listLegalDocuments', () => {
  const LIST_INPUT = { limit: 20, offset: 0 }

  it('returns cached summaries when available', async () => {
    const cached = [{ id: DOCUMENT_ID, legal_type: 'tutela', status: 'draft' }]
    mockGetCache.mockResolvedValueOnce(cached)

    const result = await listLegalDocuments(CITIZEN_ID, LIST_INPUT)

    expect(mockQueryRaw).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })

  it('queries DB and returns summaries when cache is empty', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      id:           DOCUMENT_ID,
      legal_type:   'derecho_de_peticion',
      status:       'draft',
      urgency:      'media',
      target_entity: JSON.stringify({ name: 'Secretaría de Infraestructura' }),
      location:     'Cartagena',
      created_at:   NOW,
      submitted_at: null,
    }])

    const result = await listLegalDocuments(CITIZEN_ID, LIST_INPUT)

    expect(result).toHaveLength(1)
    expect(result[0]!.legal_type).toBe('derecho_de_peticion')
    expect(result[0]!.target_name).toBe('Secretaría de Infraestructura')
  })

  it('filters by status when provided', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await listLegalDocuments(CITIZEN_ID, { ...LIST_INPUT, status: 'submitted' })

    const sqlArg = mockQueryRaw.mock.calls[0]
    expect(JSON.stringify(sqlArg)).toContain('submitted')
  })
})

// ── updateLegalDocument ───────────────────────────────────────────────────────

describe('updateLegalDocument', () => {
  it('updates document_draft and returns updated document', async () => {
    const updated = { ...RAW_ROW, document_draft: 'Texto actualizado por el ciudadano' }
    mockQueryRaw.mockResolvedValueOnce([updated])

    const doc = await updateLegalDocument(DOCUMENT_ID, CITIZEN_ID, {
      document_draft: 'Texto actualizado por el ciudadano',
    })

    expect(doc?.document_draft).toBe('Texto actualizado por el ciudadano')
  })

  it('returns null if document not found or not owned', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const doc = await updateLegalDocument(DOCUMENT_ID, 'other-citizen', {
      document_draft: 'Intento de modificación',
    })

    expect(doc).toBeNull()
  })

  it('invalidates doc and list caches on success', async () => {
    mockQueryRaw.mockResolvedValueOnce([RAW_ROW])

    await updateLegalDocument(DOCUMENT_ID, CITIZEN_ID, { document_draft: 'Nuevo texto del documento legal' })

    expect(mockSetCache).toHaveBeenCalledWith('legal:doc', DOCUMENT_ID, expect.any(Object), expect.any(Number))
    expect(mockDelCache).toHaveBeenCalledWith('legal:list', CITIZEN_ID)
  })
})

// ── submitLegalDocument ───────────────────────────────────────────────────────

describe('submitLegalDocument', () => {
  it('marks document as submitted and returns updated doc', async () => {
    const submittedRow = { ...RAW_ROW, status: 'submitted', submitted_at: new Date(), submitted_via: 'email' }
    mockQueryRaw.mockResolvedValueOnce([submittedRow])

    const doc = await submitLegalDocument(DOCUMENT_ID, CITIZEN_ID, { submitted_via: 'email' })

    expect(doc?.status).toBe('submitted')
    expect(doc?.submitted_via).toBe('email')
  })

  it('returns null if document is not in draft or ready state', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const doc = await submitLegalDocument(DOCUMENT_ID, CITIZEN_ID, { submitted_via: 'manual' })

    expect(doc).toBeNull()
  })
})

// ── deleteLegalDocument ───────────────────────────────────────────────────────

describe('deleteLegalDocument', () => {
  it('deletes draft document and returns true', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: DOCUMENT_ID }])

    const result = await deleteLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(result).toBe(true)
    expect(mockDelCache).toHaveBeenCalledWith('legal:doc', DOCUMENT_ID)
    expect(mockDelCache).toHaveBeenCalledWith('legal:list', CITIZEN_ID)
  })

  it('returns false for non-draft document or wrong owner', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    const result = await deleteLegalDocument(DOCUMENT_ID, CITIZEN_ID)

    expect(result).toBe(false)
  })
})

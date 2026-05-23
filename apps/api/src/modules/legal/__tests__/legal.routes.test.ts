jest.mock('../../../lib/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG'), get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn() },
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    citizen: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  },
}))

const mockCreate   = jest.fn()
const mockGet      = jest.fn()
const mockList     = jest.fn()
const mockUpdate   = jest.fn()
const mockSubmit   = jest.fn()
const mockDelete   = jest.fn()

jest.mock('../legal.service', () => ({
  createLegalDocument:  mockCreate,
  getLegalDocument:     mockGet,
  listLegalDocuments:   mockList,
  updateLegalDocument:  mockUpdate,
  submitLegalDocument:  mockSubmit,
  deleteLegalDocument:  mockDelete,
}))

import { buildApp } from '../../../app'

const app = buildApp()
const DID        = 'did:vertice:550e8400-e29b-41d4-a716-446655440000'
const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440001'
const DOC_ID     = '660e8400-e29b-41d4-a716-446655440002'

let token: string

beforeAll(async () => {
  await app.ready()
  token = app.jwt.sign({ sub: CITIZEN_ID, did: DID, lvl: 1 })
})
afterAll(() => app.close())
beforeEach(() => jest.resetAllMocks())

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = '2025-06-01T12:00:00.000Z'

const MOCK_DOC = {
  id:                     DOC_ID,
  citizen_id:             CITIZEN_ID,
  legal_type:             'derecho_de_peticion',
  status:                 'draft',
  urgency:                'media',
  situation_description:  'Hay un hueco en la calle 34 que lleva meses sin reparar y ha causado accidentes.',
  evidence_description:   'Foto del hueco tomada el 1 de mayo',
  location:               'Calle 34, Cartagena',
  evidence_urls:          [],
  rights_affected:        ['Derecho a la movilidad segura'],
  target_entity: {
    name:           'Secretaría Distrital de Infraestructura',
    type:           'distrital',
    address:        'Calle 36 No. 6-60',
    email:          'infraestructura@cartagena.gov.co',
    phone:          '(605) 650-5001',
    contact_person: 'Secretario de Infraestructura',
  },
  response_deadline_days: 15,
  legal_basis:            ['Artículo 23 CP', 'Ley 1755 de 2015'],
  alternative_remedies:   ['Acción popular'],
  next_steps:             ['Esperar 15 días hábiles'],
  legal_orientation:      'Tiene derecho a reclamar la reparación del vía pública.',
  ai_audit_id:            'audit-123',
  document_draft:         'Señor Secretario: Por medio del presente escrito ...',
  submitted_at:           null,
  submitted_via:          null,
  entity_response:        null,
  entity_responded_at:    null,
  response_deadline_at:   null,
  created_at:             NOW,
  updated_at:             NOW,
}

const MOCK_SUMMARIES = [
  {
    id:          DOC_ID,
    legal_type:  'derecho_de_peticion',
    status:      'draft',
    urgency:     'media',
    target_name: 'Secretaría Distrital de Infraestructura',
    location:    'Calle 34, Cartagena',
    created_at:  NOW,
    submitted_at: null,
  },
]

// ── GET /legal — Listar documentos ────────────────────────────────────────────

describe('GET /legal', () => {
  it('returns list of documents for authenticated citizen', async () => {
    mockList.mockResolvedValue(MOCK_SUMMARIES)

    const res = await app.inject({
      method:  'GET',
      url:     '/legal',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.documents).toHaveLength(1)
    expect(body.count).toBe(1)
    expect(body.documents[0].legal_type).toBe('derecho_de_peticion')
  })

  it('filters by status when provided', async () => {
    mockList.mockResolvedValue([])

    const res = await app.inject({
      method:  'GET',
      url:     '/legal?status=submitted',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockList).toHaveBeenCalledWith(
      CITIZEN_ID,
      expect.objectContaining({ status: 'submitted' })
    )
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/legal' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for invalid status filter', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/legal?status=unknown_status',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /legal — Crear documento ─────────────────────────────────────────────

describe('POST /legal', () => {
  const VALID_BODY = {
    situation_description: 'Hay un hueco en la calle 34 que lleva meses sin reparar y ha causado accidentes.',
    evidence_description:  'Foto del hueco tomada el 1 de mayo de 2025',
    location:              'Calle 34 con Av. Blas de Lezo, Cartagena',
    category:              'infraestructura',
  }

  it('creates a document and returns 201', async () => {
    mockCreate.mockResolvedValue(MOCK_DOC)

    const res = await app.inject({
      method:  'POST',
      url:     '/legal',
      headers: { Authorization: `Bearer ${token}` },
      payload: VALID_BODY,
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.legal_type).toBe('derecho_de_peticion')
    expect(body.status).toBe('draft')
  })

  it('returns 503 when AI service throws', async () => {
    mockCreate.mockRejectedValue(new Error('AI service error 503: Service unavailable'))

    const res = await app.inject({
      method:  'POST',
      url:     '/legal',
      headers: { Authorization: `Bearer ${token}` },
      payload: VALID_BODY,
    })

    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('AI_SERVICE_UNAVAILABLE')
  })

  it('returns 400 when situation_description is too short', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/legal',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...VALID_BODY, situation_description: 'Corto' },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('INVALID_INPUT')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/legal',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── GET /legal/:id — Obtener documento ───────────────────────────────────────

describe('GET /legal/:id', () => {
  it('returns the document for the owner', async () => {
    mockGet.mockResolvedValue(MOCK_DOC)

    const res = await app.inject({
      method:  'GET',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.id).toBe(DOC_ID)
    expect(body.document_draft).toBeTruthy()
  })

  it('returns 404 when document not found', async () => {
    mockGet.mockResolvedValue(null)

    const res = await app.inject({
      method:  'GET',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('NOT_FOUND')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: `/legal/${DOC_ID}` })
    expect(res.statusCode).toBe(401)
  })
})

// ── PUT /legal/:id — Editar borrador ─────────────────────────────────────────

describe('PUT /legal/:id', () => {
  it('updates document_draft and returns updated doc', async () => {
    const updatedDoc = { ...MOCK_DOC, document_draft: 'Texto revisado por el ciudadano para envío formal.' }
    mockUpdate.mockResolvedValue(updatedDoc)

    const res = await app.inject({
      method:  'PUT',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { document_draft: 'Texto revisado por el ciudadano para envío formal.' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.document_draft).toBe('Texto revisado por el ciudadano para envío formal.')
  })

  it('returns 404 when document not found', async () => {
    mockUpdate.mockResolvedValue(null)

    const res = await app.inject({
      method:  'PUT',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { document_draft: 'Texto revisado por el ciudadano para envío formal.' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for document_draft shorter than 50 characters', async () => {
    const res = await app.inject({
      method:  'PUT',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { document_draft: 'Texto corto' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method:  'PUT',
      url:     `/legal/${DOC_ID}`,
      payload: { document_draft: 'x'.repeat(60) },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /legal/:id/submit — Enviar documento ─────────────────────────────────

describe('POST /legal/:id/submit', () => {
  it('submits document via email and returns updated doc', async () => {
    const submittedDoc = {
      ...MOCK_DOC,
      status:       'submitted',
      submitted_via: 'email',
      submitted_at: NOW,
    }
    mockSubmit.mockResolvedValue(submittedDoc)

    const res = await app.inject({
      method:  'POST',
      url:     `/legal/${DOC_ID}/submit`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { submitted_via: 'email' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('submitted')
    expect(body.submitted_via).toBe('email')
  })

  it('returns 400 when document is not in submittable state', async () => {
    mockSubmit.mockResolvedValue(null)

    const res = await app.inject({
      method:  'POST',
      url:     `/legal/${DOC_ID}/submit`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { submitted_via: 'manual' },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('INVALID_STATUS')
  })

  it('returns 400 for invalid submitted_via value', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     `/legal/${DOC_ID}/submit`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { submitted_via: 'fax' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     `/legal/${DOC_ID}/submit`,
      payload: { submitted_via: 'email' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── DELETE /legal/:id — Eliminar borrador ─────────────────────────────────────

describe('DELETE /legal/:id', () => {
  it('deletes a draft document and returns 204', async () => {
    mockDelete.mockResolvedValue(true)

    const res = await app.inject({
      method:  'DELETE',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 400 when document is not a draft', async () => {
    mockDelete.mockResolvedValue(false)

    const res = await app.inject({
      method:  'DELETE',
      url:     `/legal/${DOC_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.code).toBe('DELETE_NOT_ALLOWED')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method:  'DELETE',
      url:     `/legal/${DOC_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })
})

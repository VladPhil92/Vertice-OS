import { prisma } from '../../../lib/prisma'
import {
  addCivicActionEvidence,
  createCivicAction,
  getCivicAction,
  getCivicActionValidationState,
  listCivicActions,
  removeCivicActionValidation,
  reviewCivicAction,
  setCivicActionValidation,
  updateCivicAction,
} from '../civic-actions.service'

const OWNER_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_ID = '550e8400-e29b-41d4-a716-446655440001'
const ACTION_ID = '550e8400-e29b-41d4-a716-446655440010'

const VALID_CREATE_INPUT = {
  title: 'Recuperación del parque comunitario',
  problem: 'El parque presenta deterioro sostenido y falta de mantenimiento comunitario.',
  objective: 'Recuperar el espacio mediante una jornada vecinal documentada.',
  category: 'espacio público',
}

const PHOTO_EVIDENCE = {
  evidence_type: 'photo' as const,
  evidence_url: 'https://example.com/evidence/photo.jpg',
}

describe('civic actions service guards and policy branches', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('fails closed when an action is not visible to the viewer', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(getCivicAction(ACTION_ID, OTHER_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_ACTION_NOT_FOUND',
    })
  })

  it('fails explicitly when persistence does not return a created action id', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(createCivicAction(OWNER_ID, VALID_CREATE_INPUT)).rejects.toThrow(
      'No fue posible crear la acción cívica',
    )
  })

  it('requires the action owner before applying an update', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      { actor_id: OWNER_ID, status: 'proposed' },
    ] as never)

    await expect(updateCivicAction(OTHER_ID, ACTION_ID, {
      status: 'preparing',
    })).rejects.toMatchObject({
      statusCode: 403,
      code: 'CIVIC_ACTION_OWNER_REQUIRED',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('rejects an owner transition that skips the civic action lifecycle', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      { actor_id: OWNER_ID, status: 'proposed' },
    ] as never)

    await expect(updateCivicAction(OWNER_ID, ACTION_ID, {
      status: 'result_declared',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_ACTION_INVALID_TRANSITION',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('rejects evidence from a citizen who is neither owner nor collaborator', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(addCivicActionEvidence(OTHER_ID, ACTION_ID, PHOTO_EVIDENCE)).rejects.toMatchObject({
      statusCode: 403,
      code: 'CIVIC_ACTION_EVIDENCE_FORBIDDEN',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('rejects duplicate evidence after an authorized submission attempt', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ ok: 1 }] as never)
      .mockResolvedValueOnce([] as never)

    await expect(addCivicActionEvidence(OWNER_ID, ACTION_ID, PHOTO_EVIDENCE)).rejects.toMatchObject({
      statusCode: 409,
      code: 'DUPLICATE_CIVIC_EVIDENCE',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('returns anonymous validation totals without inventing a viewer stance', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ actor_id: OWNER_ID }] as never)
      .mockResolvedValueOnce([{ corroborations: 3n, disputes: 2n }] as never)

    await expect(getCivicActionValidationState(ACTION_ID)).resolves.toEqual({
      corroborations: 3,
      disputes: 2,
      total: 5,
      my_stance: null,
      my_note: null,
    })
    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it('returns zero validation counts when no validation rows exist', async () => {
    jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ actor_id: OWNER_ID }] as never)
      .mockResolvedValueOnce([] as never)

    await expect(getCivicActionValidationState(ACTION_ID)).resolves.toEqual({
      corroborations: 0,
      disputes: 0,
      total: 0,
      my_stance: null,
      my_note: null,
    })
  })

  it('rejects self-validation before writing a community stance', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      { actor_id: OWNER_ID, status: 'in_progress' },
    ] as never)

    await expect(setCivicActionValidation(OWNER_ID, ACTION_ID, {
      stance: 'corroborate',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SELF_VALIDATION_NOT_ALLOWED',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('does not allow validation of cancelled civic actions', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      { actor_id: OWNER_ID, status: 'cancelled' },
    ] as never)

    await expect(setCivicActionValidation(OTHER_ID, ACTION_ID, {
      stance: 'corroborate',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_ACTION_NOT_VALIDATABLE',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('removes a viewer validation and returns the refreshed state', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ actor_id: OWNER_ID }] as never)
      .mockResolvedValueOnce([{ corroborations: 1n, disputes: 0n }] as never)
      .mockResolvedValueOnce([] as never)

    await expect(removeCivicActionValidation(OTHER_ID, ACTION_ID)).resolves.toEqual({
      corroborations: 1,
      disputes: 0,
      total: 1,
      my_stance: null,
      my_note: null,
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledTimes(3)
  })

  it('rejects reviewer decisions that do not follow the review state machine', async () => {
    const transactionSpy = jest.spyOn(prisma, '$transaction')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      { actor_id: OWNER_ID, status: 'proposed' },
    ] as never)

    await expect(reviewCivicAction(OTHER_ID, ACTION_ID, {
      decision: 'verified',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_ACTION_INVALID_REVIEW_TRANSITION',
    })
    expect(transactionSpy).not.toHaveBeenCalled()
  })

  it('builds public feed filters for status, neighborhood and category', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(listCivicActions({
      limit: 20,
      status: 'verified',
      neighborhood: 'Manga',
      category: 'salud',
    })).resolves.toEqual([])
    expect(querySpy).toHaveBeenCalledTimes(1)
  })
})

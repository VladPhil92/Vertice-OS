jest.mock('../../lib/prisma', () => ({
  prisma: { $queryRaw: jest.fn(), $executeRaw: jest.fn() },
}))
jest.mock('../../lib/audit', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { prisma } from '../../lib/prisma'
import { recordAuditEvent } from '../../lib/audit'
import { logger } from '../../lib/logger'
import {
  getActivationMetrics,
  getActivationRanking,
  getMyTerritory,
  getTerritory,
  listTerritories,
  refreshDivipolaCatalogBestEffort,
  setActivationStatus,
  setMyTerritory,
  syncDivipolaCatalog,
  type TerritoryRow,
} from './territories.service'

const mockQueryRaw = prisma.$queryRaw as jest.Mock
const mockExecuteRaw = prisma.$executeRaw as jest.Mock
const mockRecordAuditEvent = recordAuditEvent as jest.Mock

const TERRITORY: TerritoryRow = {
  code: 'CO-MP-13001',
  external_code: '13001',
  name: 'Cartagena de Indias',
  level: 'municipality',
  parent_code: 'CO-DP-13',
  country_code: 'CO',
  slug: 'cartagena-de-indias',
  activation_status: 'available',
  source: 'dane_divipola',
  source_version: 'MGN_2025',
  activated_at: null,
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('listTerritories', () => {
  it('queries with any combination of filters and returns the raw rows', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])

    const result = await listTerritories({ limit: 50, offset: 0 })
    expect(result).toEqual([TERRITORY])
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('accepts level, parent_code, activation_status and q filters together', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await listTerritories({
      level: 'municipality',
      parent_code: 'CO-DP-13',
      activation_status: 'pilot_ready',
      q: 'Cartagena',
      limit: 10,
      offset: 5,
    })
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('getTerritory', () => {
  it('returns the territory when found', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    await expect(getTerritory('CO-MP-13001')).resolves.toEqual(TERRITORY)
  })

  it('throws 404 when the territory does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getTerritory('CO-MP-00000')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TERRITORY_NOT_FOUND',
    })
  })
})

describe('getMyTerritory', () => {
  it('returns the citizen territory row when found', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      territory_code: 'CO-MP-13001',
      neighborhood: 'Manga',
      locality_id: 1,
      territory_name: 'Cartagena de Indias',
      territory_level: 'municipality',
      activation_status: 'available',
      department_code: 'CO-DP-13',
      department_name: 'Bolívar',
    }])
    const result = await getMyTerritory('citizen-1')
    expect(result.territory_code).toBe('CO-MP-13001')
  })

  it('throws 404 when the citizen does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(getMyTerritory('missing-citizen')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  })
})

describe('setMyTerritory', () => {
  it('rejects a non-municipal/district territory', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, level: 'department' }])
    await expect(setMyTerritory('citizen-1', 'CO-DP-13')).rejects.toMatchObject({
      statusCode: 400,
      code: 'PRIMARY_TERRITORY_MUST_BE_MUNICIPAL',
    })
  })

  it('rejects a territory outside Colombia', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, country_code: 'MX' }])
    await expect(setMyTerritory('citizen-1', 'CO-MP-13001')).rejects.toMatchObject({
      statusCode: 400,
      code: 'COUNTRY_NOT_SUPPORTED',
    })
  })

  it('throws 404 when the citizen does not exist', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    mockQueryRaw.mockResolvedValueOnce([])
    await expect(setMyTerritory('missing-citizen', 'CO-MP-13001')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CITIZEN_NOT_FOUND',
    })
  })

  it('updates the citizen territory and neighborhood on success', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    mockQueryRaw.mockResolvedValueOnce([{
      territory_code: 'CO-MP-13001', neighborhood: 'Manga', locality_id: null,
    }])
    const result = await setMyTerritory('citizen-1', 'CO-MP-13001', ' Manga ')
    expect(result.territory).toEqual(TERRITORY)
    expect(result.neighborhood).toBe('Manga')
  })
})

describe('getActivationMetrics', () => {
  it('rejects a non-municipal/district territory', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, level: 'department' }])
    await expect(getActivationMetrics('CO-DP-13')).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACTIVATION_LEVEL_UNSUPPORTED',
    })
  })

  it('recommends available for a territory with no measured activity', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    mockQueryRaw.mockResolvedValueOnce([{
      registered_citizens: 0n, active_citizens_30d: 0n, civic_actions_30d: 0n,
      verified_actions_90d: 0n, reports_30d: 0n, proposals_30d: 0n,
    }])
    const result = await getActivationMetrics('CO-MP-13001')
    expect(result.momentum_score).toBe(0)
    expect(result.recommended_status).toBe('available')
  })

  it('recommends verified_network once momentum crosses the top threshold', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    mockQueryRaw.mockResolvedValueOnce([{
      registered_citizens: 100n, active_citizens_30d: 100n, civic_actions_30d: 100n,
      verified_actions_90d: 100n, reports_30d: 100n, proposals_30d: 100n,
    }])
    const result = await getActivationMetrics('CO-MP-13001')
    expect(result.momentum_score).toBe(100)
    expect(result.recommended_status).toBe('verified_network')
  })

  it('handles a missing metrics row by defaulting every counter to zero', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY])
    mockQueryRaw.mockResolvedValueOnce([])
    const result = await getActivationMetrics('CO-MP-13001')
    expect(result.registered_citizens).toBe(0)
    expect(result.recommended_status).toBe('available')
  })
})

describe('getActivationRanking', () => {
  it('excludes non-municipal territories and sorts by momentum then name', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { ...TERRITORY, code: 'CO-DP-13', level: 'department', name: 'Bolívar' },
      { ...TERRITORY, code: 'CO-MP-13001', level: 'municipality', name: 'Cartagena de Indias' },
      { ...TERRITORY, code: 'CO-MP-05001', level: 'municipality', name: 'Medellín' },
    ])
    // getActivationMetrics(CO-MP-13001): re-resolves the territory (getTerritory), then its metrics.
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, code: 'CO-MP-13001', name: 'Cartagena de Indias' }])
    mockQueryRaw.mockResolvedValueOnce([{
      registered_citizens: 10n, active_citizens_30d: 10n, civic_actions_30d: 10n,
      verified_actions_90d: 10n, reports_30d: 10n, proposals_30d: 10n,
    }])
    // getActivationMetrics(CO-MP-05001)
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, code: 'CO-MP-05001', name: 'Medellín' }])
    mockQueryRaw.mockResolvedValueOnce([{
      registered_citizens: 0n, active_citizens_30d: 0n, civic_actions_30d: 0n,
      verified_actions_90d: 0n, reports_30d: 0n, proposals_30d: 0n,
    }])

    const result = await getActivationRanking(25)
    expect(result).toHaveLength(2)
    expect(result[0]?.code).toBe('CO-MP-13001')
    expect(result[1]?.code).toBe('CO-MP-05001')
  })
})

describe('setActivationStatus', () => {
  it('rejects a non-municipal/district territory', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, level: 'department' }])
    await expect(setActivationStatus({
      actorId: 'admin-1', territoryCode: 'CO-DP-13', status: 'pilot_ready', reason: 'promoted',
    })).rejects.toMatchObject({ statusCode: 400, code: 'ACTIVATION_LEVEL_UNSUPPORTED' })
  })

  it('updates the status and records an audit event', async () => {
    mockQueryRaw.mockResolvedValueOnce([TERRITORY]) // getTerritory (level guard)
    mockQueryRaw.mockResolvedValueOnce([TERRITORY]) // getActivationMetrics -> getTerritory
    mockQueryRaw.mockResolvedValueOnce([{
      registered_citizens: 5n, active_citizens_30d: 5n, civic_actions_30d: 5n,
      verified_actions_90d: 0n, reports_30d: 0n, proposals_30d: 0n,
    }]) // getActivationMetrics -> rawActivationMetrics
    mockQueryRaw.mockResolvedValueOnce([{ ...TERRITORY, activation_status: 'pilot_ready' }]) // UPDATE ... RETURNING

    const result = await setActivationStatus({
      actorId: 'admin-1', territoryCode: 'CO-MP-13001', status: 'pilot_ready', reason: 'meets pilot criteria',
    })

    expect(result.territory?.activation_status).toBe('pilot_ready')
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1',
      action: 'territory_activation_status_changed',
      targetId: 'CO-MP-13001',
      result: 'pilot_ready',
    }))
  })
})

describe('syncDivipolaCatalog', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('skips the sync when a recent successful run is still fresh', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ completed_at: new Date() }])

    const result = await syncDivipolaCatalog()
    expect(result).toMatchObject({ skipped: true, reason: 'fresh_catalog' })
    expect(global.fetch).toBe(originalFetch)
  })

  it('marks the run failed when the DANE endpoint responds with an error status', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-1' }])
    mockExecuteRaw.mockResolvedValue(undefined)
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch

    await expect(syncDivipolaCatalog({ force: true })).rejects.toThrow('DANE DIVIPOLA responded 503')
    expect(mockExecuteRaw).toHaveBeenCalled()
  })

  it('rejects a payload without a features array', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-1' }])
    mockExecuteRaw.mockResolvedValue(undefined)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({}),
    }) as unknown as typeof fetch

    await expect(syncDivipolaCatalog({ force: true })).rejects.toThrow('no features array')
  })

  it('rejects an unexpectedly small catalog', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-1' }])
    mockExecuteRaw.mockResolvedValue(undefined)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ attributes: {
          DPTO_CCDGO: '13', DPTO_CNMBRE: 'Bolívar', MPIO_CDPMP: '13001', MPIO_CNMBRE: 'Cartagena', MPIO_TIPO: 'Municipio',
        } }],
      }),
    }) as unknown as typeof fetch

    await expect(syncDivipolaCatalog({ force: true })).rejects.toThrow('unexpectedly small catalog')
  })

  it('upserts departments and municipalities for a valid full catalog', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-1' }])
    mockExecuteRaw.mockResolvedValue(undefined)

    const features = Array.from({ length: 500 }, (_, i) => {
      const municipalityCode = String(13001 + i).padStart(5, '0')
      return {
        attributes: {
          DPTO_CCDGO: '13',
          DPTO_CNMBRE: 'Bolívar',
          MPIO_CDPMP: municipalityCode,
          MPIO_CNMBRE: `Municipio ${i}`,
          MPIO_TIPO: i === 0 ? 'Distrito' : 'Municipio',
          MPIO_NANO: '2025',
        },
      }
    })
    // One malformed feature (wrong department/municipality prefix) must be filtered out silently.
    features.push({ attributes: {
      DPTO_CCDGO: '13', DPTO_CNMBRE: 'Bolívar', MPIO_CDPMP: '05001', MPIO_CNMBRE: 'Fuera de departamento', MPIO_TIPO: 'Municipio', MPIO_NANO: '2025',
    } })

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features }),
    }) as unknown as typeof fetch

    const result = await syncDivipolaCatalog({ force: true })
    expect(result).toMatchObject({ skipped: false, records_seen: features.length, records_upserted: 500 })
  })
})

describe('refreshDivipolaCatalogBestEffort', () => {
  it('logs and swallows any sync failure', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ completed_at: new Date(0) }])
    mockQueryRaw.mockResolvedValueOnce([{ id: 'run-1' }])
    mockExecuteRaw.mockResolvedValue(undefined)
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    await expect(refreshDivipolaCatalogBestEffort()).resolves.toBeUndefined()
    expect((logger.warn as jest.Mock)).toHaveBeenCalled()
  })
})

import { CreateReportSchema, ListReportsSchema } from './territorial.schema'

const BASE_REPORT = {
  title: 'Hueco peligroso en la vía principal',
  description: 'El hueco ocupa parte del carril y representa un riesgo para motociclistas y peatones.',
  category: 'infraestructura' as const,
  lat: 6.2442,
  lng: -75.5812,
}

describe('territorial national mobility contract', () => {
  it('accepts a Medellin target independently from citizen home territory', () => {
    const parsed = CreateReportSchema.parse({
      ...BASE_REPORT,
      territory_code: 'CO-MP-05001',
      territory_source: 'gps',
    })
    expect(parsed.territory_code).toBe('CO-MP-05001')
    expect(parsed.territory_source).toBe('gps')
  })

  it('requires an explicit target when a source is declared', () => {
    expect(CreateReportSchema.safeParse({
      ...BASE_REPORT,
      territory_source: 'manual',
    }).success).toBe(false)
  })

  it('supports filtering the national report stream by canonical territory', () => {
    expect(ListReportsSchema.parse({ territory_code: 'CO-MP-05001' })).toMatchObject({
      territory_code: 'CO-MP-05001',
      limit: 20,
      offset: 0,
    })
  })
})

import { ScheduleCivicPublicationSchema } from './publishing.schema'

describe('ScheduleCivicPublicationSchema', () => {
  it('accepts a publication scheduled in the future', () => {
    const result = ScheduleCivicPublicationSchema.safeParse({
      title: 'Avance de recuperación del parque',
      body: 'Compartimos el avance documentado del proceso comunitario y los siguientes pasos.',
      neighborhood: 'Manga',
      scheduled_for: new Date(Date.now() + 10 * 60_000).toISOString(),
    })

    expect(result.success).toBe(true)
  })

  it('rejects immediate or past scheduling', () => {
    const result = ScheduleCivicPublicationSchema.safeParse({
      title: 'Actualización cívica',
      body: 'Esta publicación intenta programarse sin respetar la ventana mínima requerida.',
      scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    })

    expect(result.success).toBe(false)
  })

  it('requires enough context for a civic update', () => {
    const result = ScheduleCivicPublicationSchema.safeParse({
      title: 'Aviso',
      body: 'Muy corto',
      scheduled_for: new Date(Date.now() + 10 * 60_000).toISOString(),
    })

    expect(result.success).toBe(false)
  })
})

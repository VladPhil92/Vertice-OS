import { assertCommunityContentAllowed, screenCommunityContent } from './community.content-filter'

describe('community content screening', () => {
  it('allows ordinary civic discussion about sensitive public-safety topics', () => {
    const result = screenCommunityContent([
      {
        field: 'description',
        value: 'Solicito iluminación y acompañamiento institucional porque la comunidad reporta violencia en este sector.',
      },
    ])

    expect(result).toEqual({ allowed: true, reasons: [] })
  })

  it('blocks a direct threat aimed at another user', () => {
    const result = screenCommunityContent([
      { field: 'body', value: 'No sigas publicando eso: te voy a matar.' },
    ])

    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('body:direct_threat')
  })

  it('blocks high-confidence sexual-content promotion spam', () => {
    const result = screenCommunityContent([
      { field: 'body', value: 'Compra contenido porno en pornhub.com ahora.' },
    ])

    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('body:sexual_spam')
  })

  it('blocks excessive link spam without forbidding normal references', () => {
    const links = Array.from({ length: 9 }, (_, index) => `https://example.com/${index}`).join(' ')
    expect(screenCommunityContent([{ field: 'body', value: links }]).allowed).toBe(false)
    expect(screenCommunityContent([{ field: 'body', value: 'Fuente: https://example.com/evidence' }]).allowed).toBe(true)
  })

  it('throws a stable API error for blocked content', () => {
    expect(() => assertCommunityContentAllowed([
      { field: 'title', value: 'I will kill you if you disagree' },
    ])).toThrow('filtro preventivo de seguridad')

    try {
      assertCommunityContentAllowed([{ field: 'title', value: 'I will kill you if you disagree' }])
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 422, code: 'UGC_CONTENT_BLOCKED' })
    }
  })
})

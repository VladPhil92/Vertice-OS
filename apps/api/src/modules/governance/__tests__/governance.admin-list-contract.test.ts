import { AdminListProposalsSchema } from '../governance.schema'

describe('admin proposal queue contract', () => {
  it('preserves the complete 200-row moderation queue by default', () => {
    const parsed = AdminListProposalsSchema.parse({})

    expect(parsed.limit).toBe(200)
    expect(parsed.offset).toBe(0)
  })

  it('validates moderation filters and caps explicit requests at 200', () => {
    const parsed = AdminListProposalsSchema.parse({
      status: 'debate',
      category: 'infraestructura',
      limit: '150',
      offset: '20',
    })

    expect(parsed).toEqual(expect.objectContaining({
      status: 'debate',
      category: 'infraestructura',
      limit: 150,
      offset: 20,
    }))

    expect(AdminListProposalsSchema.safeParse({ limit: 201 }).success).toBe(false)
  })
})

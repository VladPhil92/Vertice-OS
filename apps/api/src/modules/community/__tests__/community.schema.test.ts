import {
  CivicActivityParamsSchema,
  CivicActivityValidationSchema,
  CivicProfileParamsSchema,
  CommunityFeedQuerySchema,
  CommunityLeaderboardQuerySchema,
  UpdateCivicProfileSchema,
} from '../community.schema'

describe('community query schemas', () => {
  it('applies safe feed defaults', () => {
    expect(CommunityFeedQuerySchema.parse({})).toEqual({ limit: 40 })
  })

  it('accepts a typed civic activity filter', () => {
    expect(CommunityFeedQuerySchema.parse({ limit: '25', type: 'report', neighborhood: 'Manga' })).toEqual({
      limit: 25,
      type: 'report',
      neighborhood: 'Manga',
    })
  })

  it('rejects unsupported feed types', () => {
    expect(() => CommunityFeedQuerySchema.parse({ type: 'election' })).toThrow()
  })

  it('caps leaderboard queries to the pilot-safe contract', () => {
    expect(CommunityLeaderboardQuerySchema.parse({})).toEqual({ limit: 20 })
    expect(() => CommunityLeaderboardQuerySchema.parse({ limit: 51 })).toThrow()
  })

  it('keeps civic identity separate from authorization roles', () => {
    expect(UpdateCivicProfileSchema.parse({
      profile_type: 'candidate',
      bio: 'Gestión comunitaria documentada',
      organization: null,
      public_profile: true,
    }).profile_type).toBe('candidate')

    expect(() => UpdateCivicProfileSchema.parse({
      profile_type: 'admin',
      public_profile: true,
    })).toThrow()
  })

  it('requires UUID profile and activity identifiers', () => {
    const citizenId = '550e8400-e29b-41d4-a716-446655440000'
    expect(CivicProfileParamsSchema.parse({ citizenId })).toEqual({ citizenId })
    expect(CivicActivityParamsSchema.parse({ type: 'report', activityId: citizenId })).toEqual({
      type: 'report',
      activityId: citizenId,
    })
    expect(() => CivicProfileParamsSchema.parse({ citizenId: 'not-a-uuid' })).toThrow()
  })

  it('allows one-click corroboration without turning it into verified evidence', () => {
    expect(CivicActivityValidationSchema.parse({ stance: 'corroborate' })).toEqual({ stance: 'corroborate' })
  })

  it('requires an explanation when disputing evidence', () => {
    expect(() => CivicActivityValidationSchema.parse({ stance: 'dispute', note: 'no' })).toThrow()
    expect(CivicActivityValidationSchema.parse({
      stance: 'dispute',
      note: 'La ubicación de la evidencia no coincide con el hecho reportado.',
    }).stance).toBe('dispute')
  })
})
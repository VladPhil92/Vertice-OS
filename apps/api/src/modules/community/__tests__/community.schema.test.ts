import {
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
})

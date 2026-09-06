import { prisma } from '../../../lib/prisma'
import {
  followCivicProfile,
  getCivicProfile,
  unfollowCivicProfile,
} from '../community.service'

const VIEWER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TARGET_ID = '550e8400-e29b-41d4-a716-446655440001'

describe('community social service guards', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('rejects following your own civic profile before touching persistence', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')

    await expect(followCivicProfile(VIEWER_ID, VIEWER_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SELF_FOLLOW_NOT_ALLOWED',
    })
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('maps an active civic profile from persistence', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      citizen_id: TARGET_ID,
      display_name: 'Liderazgo Manga',
      neighborhood: 'Manga',
      civic_profile_type: 'social_leader',
      civic_bio: 'Trabajo comunitario documentado.',
      civic_organization: 'Colectivo Manga',
      public_civic_profile: true,
      reputation_score: 82,
    }] as never)

    await expect(getCivicProfile(TARGET_ID)).resolves.toEqual({
      citizen_id: TARGET_ID,
      display_name: 'Liderazgo Manga',
      neighborhood: 'Manga',
      profile_type: 'social_leader',
      bio: 'Trabajo comunitario documentado.',
      organization: 'Colectivo Manga',
      public_profile: true,
      reputation_score: 82,
    })
  })

  it('fails closed when a civic profile does not exist', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(getCivicProfile(TARGET_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('returns a privacy-safe unfollow state when the target is no longer public', async () => {
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      public_civic_profile: false,
    }] as never)

    await expect(unfollowCivicProfile(VIEWER_ID, TARGET_ID)).resolves.toEqual({
      following: false,
      follower_count: 0,
    })
  })
})

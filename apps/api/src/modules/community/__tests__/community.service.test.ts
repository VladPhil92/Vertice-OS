import { prisma } from '../../../lib/prisma'
import {
  followCivicProfile,
  getCivicProfile,
  setActivityValidation,
  unfollowCivicProfile,
} from '../community.service'

const VIEWER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TARGET_ID = '550e8400-e29b-41d4-a716-446655440001'
const REPORT_ID = '550e8400-e29b-41d4-a716-446655440010'

const PUBLIC_PROFILE_ROW = {
  citizen_id: TARGET_ID,
  display_name: 'Liderazgo Manga',
  neighborhood: 'Manga',
  civic_profile_type: 'social_leader',
  civic_bio: 'Trabajo comunitario documentado.',
  civic_organization: 'Colectivo Manga',
  public_civic_profile: true,
  reputation_score: 82,
}

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
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([PUBLIC_PROFILE_ROW] as never)

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

  it('follows a published civic profile and returns the updated follower state', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([PUBLIC_PROFILE_ROW] as never)
      .mockResolvedValueOnce([PUBLIC_PROFILE_ROW] as never)
      .mockResolvedValueOnce([{ following: true, follower_count: 13n }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)

    await expect(followCivicProfile(VIEWER_ID, TARGET_ID)).resolves.toEqual({
      following: true,
      follower_count: 13,
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledTimes(3)
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

  it('returns the public follower count after unfollowing a still-public profile', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ public_civic_profile: true }] as never)
      .mockResolvedValueOnce([PUBLIC_PROFILE_ROW] as never)
      .mockResolvedValueOnce([{ following: false, follower_count: 12n }] as never)
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)

    await expect(unfollowCivicProfile(VIEWER_ID, TARGET_ID)).resolves.toEqual({
      following: false,
      follower_count: 12,
    })
    expect(querySpy).toHaveBeenCalledTimes(3)
  })

  it('rejects validating your own civic activity before writing a stance', async () => {
    const executeSpy = jest.spyOn(prisma, '$executeRaw')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ owner_id: VIEWER_ID }] as never)

    await expect(setActivityValidation(VIEWER_ID, 'report', REPORT_ID, {
      stance: 'corroborate',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SELF_VALIDATION_NOT_ALLOWED',
    })
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('upserts a corroboration and returns the viewer validation state', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{ owner_id: TARGET_ID }] as never)
      .mockResolvedValueOnce([{ owner_id: TARGET_ID }] as never)
      .mockResolvedValueOnce([{ corroborations: 4n, disputes: 1n }] as never)
      .mockResolvedValueOnce([{ stance: 'corroborate', note: null }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)

    await expect(setActivityValidation(VIEWER_ID, 'report', REPORT_ID, {
      stance: 'corroborate',
    })).resolves.toEqual({
      corroborations: 4,
      disputes: 1,
      total: 5,
      my_stance: 'corroborate',
      my_note: null,
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledTimes(4)
  })
})
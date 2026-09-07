import { config } from '../../../config'
import { prisma } from '../../../lib/prisma'
import {
  confirmCivicAvatarUpload,
  createCivicAvatarUploadIntent,
  getCivicAvatarState,
  listPublicCivicAvatars,
  removeCivicAvatar,
} from '../civic-avatar.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440000'
const OTHER_ID = '550e8400-e29b-41d4-a716-446655440001'
const ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
const API_TOKEN = 'test-cloudflare-images-api-token'
const ASSET_ID = 'avatar-asset-1'

function enableProvider(): void {
  config.CLOUDFLARE_IMAGES_ACCOUNT_ID = ACCOUNT_ID
  config.CLOUDFLARE_IMAGES_API_TOKEN = API_TOKEN
  config.CLOUDFLARE_IMAGES_VARIANT = 'public'
}

function disableProvider(): void {
  config.CLOUDFLARE_IMAGES_ACCOUNT_ID = undefined
  config.CLOUDFLARE_IMAGES_API_TOKEN = undefined
  config.CLOUDFLARE_IMAGES_DELIVERY_URL = undefined
  config.CLOUDFLARE_IMAGES_VARIANT = 'public'
}

function providerResponse<T>(result: T, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('civic avatar service', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    disableProvider()
  })

  it('returns an approved avatar and reports storage availability', async () => {
    enableProvider()
    const updatedAt = new Date('2026-09-07T12:00:00.000Z')
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      citizen_id: CITIZEN_ID,
      civic_avatar_url: 'https://images.example/avatar/public',
      civic_avatar_status: 'approved',
      civic_avatar_updated_at: updatedAt,
    }] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).resolves.toEqual({
      citizen_id: CITIZEN_ID,
      avatar_url: 'https://images.example/avatar/public',
      status: 'approved',
      updated_at: updatedAt.toISOString(),
      upload_enabled: true,
    })
  })

  it('never exposes a rejected avatar URL', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      citizen_id: CITIZEN_ID,
      civic_avatar_url: 'https://images.example/rejected/public',
      civic_avatar_status: 'rejected',
      civic_avatar_updated_at: null,
    }] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).resolves.toMatchObject({
      avatar_url: null,
      status: 'rejected',
      updated_at: null,
      upload_enabled: false,
    })
  })

  it('fails closed when the civic profile does not exist', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('deduplicates public avatar lookup and only exposes approved media', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
      {
        citizen_id: CITIZEN_ID,
        civic_avatar_url: 'https://images.example/approved/public',
        civic_avatar_status: 'approved',
        verification_level: 1,
      },
      {
        citizen_id: OTHER_ID,
        civic_avatar_url: 'https://images.example/rejected/public',
        civic_avatar_status: 'rejected',
        verification_level: 0,
      },
    ] as never)

    await expect(listPublicCivicAvatars([CITIZEN_ID, CITIZEN_ID, OTHER_ID])).resolves.toEqual({
      [CITIZEN_ID]: {
        citizen_id: CITIZEN_ID,
        avatar_url: 'https://images.example/approved/public',
        identity_verified: true,
      },
      [OTHER_ID]: {
        citizen_id: OTHER_ID,
        avatar_url: null,
        identity_verified: false,
      },
    })
    expect(querySpy).toHaveBeenCalledTimes(1)
  })

  it('avoids persistence lookup for an empty public avatar request', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')

    await expect(listPublicCivicAvatars([])).resolves.toEqual({})
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('fails upload intent creation closed when Cloudflare Images is not configured', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'CIVIC_AVATAR_STORAGE_UNAVAILABLE',
    })
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('rejects upload intent creation for a missing profile', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('replaces a pending upload intent and persists the new provider asset id', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: 'old-pending' }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(providerResponse({
        id: ASSET_ID,
        uploadURL: 'https://upload.example/direct',
      }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).resolves.toEqual({
      asset_id: ASSET_ID,
      upload_url: 'https://upload.example/direct',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('maps malformed provider JSON to a stable gateway error', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('not-json', { status: 200 }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_PROVIDER_INVALID_RESPONSE',
    })
  })

  it('surfaces provider errors without treating a failed upload session as valid', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      success: false,
      errors: [{ message: 'provider unavailable' }],
    }), { status: 503, headers: { 'content-type': 'application/json' } }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_PROVIDER_ERROR',
      message: 'provider unavailable',
    })
  })

  it('rejects an incomplete direct-upload intent returned by the provider', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResponse({
      id: ASSET_ID,
      uploadURL: '',
    }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_UPLOAD_INTENT_INVALID',
    })
  })

  it('rejects confirmation when the pending upload does not belong to the profile session', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: 'another-asset',
      current_asset_id: null,
    }] as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_UPLOAD_MISMATCH',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects confirmation when Cloudflare returns a different asset', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: ASSET_ID,
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResponse({
      id: 'different-asset',
      variants: ['https://images.example/different/public'],
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_ASSET_MISMATCH',
    })
  })

  it('rejects confirmation when provider metadata names another citizen', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: ASSET_ID,
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResponse({
      id: ASSET_ID,
      variants: ['https://images.example/avatar/public'],
      metadata: { citizen_id: OTHER_ID },
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_OWNER_MISMATCH',
    })
  })

  it('rejects confirmation when the provider has no public delivery URL', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: ASSET_ID,
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResponse({
      id: ASSET_ID,
      variants: ['not-a-public-url'],
      metadata: { citizen_id: CITIZEN_ID },
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_DELIVERY_URL_MISSING',
    })
  })

  it('confirms a valid upload, builds the configured delivery URL and retires the previous asset', async () => {
    enableProvider()
    config.CLOUDFLARE_IMAGES_DELIVERY_URL = 'https://imagedelivery.net/account/'
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        pending_asset_id: ASSET_ID,
        current_asset_id: 'old-current',
      }] as never)
      .mockResolvedValueOnce([{
        citizen_id: CITIZEN_ID,
        civic_avatar_url: `https://imagedelivery.net/account/${ASSET_ID}/public`,
        civic_avatar_status: 'approved',
        civic_avatar_updated_at: new Date('2026-09-07T12:00:00.000Z'),
      }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(providerResponse({
        id: ASSET_ID,
        metadata: { citizen_id: CITIZEN_ID },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const result = await confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)

    expect(result.avatar_url).toBe(`https://imagedelivery.net/account/${ASSET_ID}/public`)
    expect(result.status).toBe('approved')
    expect(querySpy).toHaveBeenCalledTimes(2)
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('uses a HTTPS provider variant when no delivery base URL is configured', async () => {
    enableProvider()
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        pending_asset_id: ASSET_ID,
        current_asset_id: null,
      }] as never)
      .mockResolvedValueOnce([{
        citizen_id: CITIZEN_ID,
        civic_avatar_url: 'https://images.example/avatar/public',
        civic_avatar_status: 'approved',
        civic_avatar_updated_at: null,
      }] as never)
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerResponse({
      id: ASSET_ID,
      variants: ['https://images.example/avatar/public'],
      metadata: { citizen_id: CITIZEN_ID },
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, ASSET_ID)).resolves.toMatchObject({
      avatar_url: 'https://images.example/avatar/public',
      status: 'approved',
    })
    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it('removes current and pending avatar assets while clearing public persistence first', async () => {
    enableProvider()
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        current_asset_id: 'current-asset',
        pending_asset_id: 'pending-asset',
      }] as never)
      .mockResolvedValueOnce([{
        citizen_id: CITIZEN_ID,
        civic_avatar_url: null,
        civic_avatar_status: 'missing',
        civic_avatar_updated_at: new Date('2026-09-07T12:30:00.000Z'),
      }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await expect(removeCivicAvatar(CITIZEN_ID)).resolves.toMatchObject({
      avatar_url: null,
      status: 'missing',
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it('clears avatar persistence even when provider deletion throws', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        current_asset_id: 'current-asset',
        pending_asset_id: null,
      }] as never)
      .mockResolvedValueOnce([{
        citizen_id: CITIZEN_ID,
        civic_avatar_url: null,
        civic_avatar_status: 'missing',
        civic_avatar_updated_at: null,
      }] as never)
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('provider timeout'))

    await expect(removeCivicAvatar(CITIZEN_ID)).resolves.toMatchObject({
      status: 'missing',
      avatar_url: null,
    })
  })

  it('rejects avatar removal for a missing civic profile', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(removeCivicAvatar(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })
})

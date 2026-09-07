import { config } from '../../../config'
import { prisma } from '../../../lib/prisma'
import {
  confirmCivicAvatarUpload,
  createCivicAvatarUploadIntent,
  getCivicAvatarState,
  listPublicCivicAvatars,
  removeCivicAvatar,
} from '../civic-avatar.service'

const CITIZEN_ID = '550e8400-e29b-41d4-a716-446655440020'
const OTHER_ID = '550e8400-e29b-41d4-a716-446655440021'
const ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
const API_TOKEN = 'test-cloudflare-images-token-12345'

const originalProviderConfig = {
  accountId: config.CLOUDFLARE_IMAGES_ACCOUNT_ID,
  apiToken: config.CLOUDFLARE_IMAGES_API_TOKEN,
  deliveryUrl: config.CLOUDFLARE_IMAGES_DELIVERY_URL,
  variant: config.CLOUDFLARE_IMAGES_VARIANT,
}

function enableProvider(): void {
  config.CLOUDFLARE_IMAGES_ACCOUNT_ID = ACCOUNT_ID
  config.CLOUDFLARE_IMAGES_API_TOKEN = API_TOKEN
  config.CLOUDFLARE_IMAGES_DELIVERY_URL = undefined
  config.CLOUDFLARE_IMAGES_VARIANT = 'public'
}

function providerSuccess<T>(result: T): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function approvedStateRow(assetUrl = 'https://images.example/avatar/public') {
  return {
    citizen_id: CITIZEN_ID,
    civic_avatar_url: assetUrl,
    civic_avatar_status: 'approved' as const,
    civic_avatar_updated_at: new Date('2026-09-07T18:00:00.000Z'),
  }
}

describe('civic avatar service', () => {
  afterEach(() => {
    config.CLOUDFLARE_IMAGES_ACCOUNT_ID = originalProviderConfig.accountId
    config.CLOUDFLARE_IMAGES_API_TOKEN = originalProviderConfig.apiToken
    config.CLOUDFLARE_IMAGES_DELIVERY_URL = originalProviderConfig.deliveryUrl
    config.CLOUDFLARE_IMAGES_VARIANT = originalProviderConfig.variant
    jest.restoreAllMocks()
  })

  it('returns approved avatar state while reporting uploads disabled without provider credentials', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([approvedStateRow()] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).resolves.toEqual({
      citizen_id: CITIZEN_ID,
      avatar_url: 'https://images.example/avatar/public',
      status: 'approved',
      updated_at: '2026-09-07T18:00:00.000Z',
      upload_enabled: false,
    })
  })

  it('hides a stored avatar URL unless the portrait is approved', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      ...approvedStateRow(),
      civic_avatar_status: 'rejected',
    }] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).resolves.toMatchObject({
      avatar_url: null,
      status: 'rejected',
    })
  })

  it('fails closed when avatar state is requested for a missing civic profile', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(getCivicAvatarState(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('short-circuits public avatar lookup for an empty citizen list', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')

    await expect(listPublicCivicAvatars([])).resolves.toEqual({})
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('deduplicates public avatar lookup and exposes only approved portraits', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([
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
  })

  it('fails upload intent creation closed when Cloudflare Images is not configured', async () => {
    const querySpy = jest.spyOn(prisma, '$queryRaw')

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'CIVIC_AVATAR_STORAGE_UNAVAILABLE',
    })
    expect(querySpy).not.toHaveBeenCalled()
  })

  it('rejects upload intent creation for a missing civic profile', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('cleans a previous pending asset and creates a new direct-upload intent', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: 'pending-old' }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(providerSuccess({ id: 'pending-new', uploadURL: 'https://upload.example/direct' }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).resolves.toEqual({
      asset_id: 'pending-new',
      upload_url: 'https://upload.example/direct',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/images/v1/pending-old')
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' })
    expect(fetchSpy.mock.calls[1]?.[0]).toContain('/images/v2/direct_upload')
    expect(fetchSpy.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps intent creation available when best-effort cleanup of an old pending asset fails', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: 'pending-stale' }] as never)
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    jest.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('provider cleanup timeout'))
      .mockResolvedValueOnce(providerSuccess({ id: 'pending-new', uploadURL: 'https://upload.example/direct' }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).resolves.toMatchObject({
      asset_id: 'pending-new',
    })
  })

  it('maps invalid provider JSON to a stable gateway error', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('not-json', { status: 200 }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_PROVIDER_INVALID_RESPONSE',
    })
  })

  it('propagates a safe provider error when Cloudflare rejects an upload intent', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      success: false,
      errors: [{ message: 'direct upload denied' }],
    }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_PROVIDER_ERROR',
      message: 'direct upload denied',
    })
  })

  it('rejects an incomplete direct-upload intent returned by the provider', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ pending_asset_id: null }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerSuccess({ id: '', uploadURL: '' }))

    await expect(createCivicAvatarUploadIntent(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_UPLOAD_INTENT_INVALID',
    })
  })

  it('rejects avatar confirmation for a missing civic profile', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('rejects avatar confirmation when the pending asset belongs to another session', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: 'asset-other',
      current_asset_id: null,
    }] as never)

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_UPLOAD_MISMATCH',
    })
  })

  it('rejects avatar confirmation when Cloudflare returns a different asset id', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: 'asset-1',
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerSuccess({
      id: 'asset-other',
      variants: ['https://images.example/asset-other/public'],
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_ASSET_MISMATCH',
    })
  })

  it('rejects avatar confirmation when provider metadata identifies another owner', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: 'asset-1',
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerSuccess({
      id: 'asset-1',
      variants: ['https://images.example/asset-1/public'],
      metadata: { citizen_id: OTHER_ID },
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CIVIC_AVATAR_OWNER_MISMATCH',
    })
  })

  it('fails confirmation when no public delivery URL can be resolved', async () => {
    enableProvider()
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{
      pending_asset_id: 'asset-1',
      current_asset_id: null,
    }] as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerSuccess({
      id: 'asset-1',
      variants: ['not-a-public-url'],
      metadata: { citizen_id: CITIZEN_ID },
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).rejects.toMatchObject({
      statusCode: 502,
      code: 'CIVIC_AVATAR_DELIVERY_URL_MISSING',
    })
  })

  it('confirms an upload using the configured delivery base and removes the replaced provider asset', async () => {
    enableProvider()
    config.CLOUDFLARE_IMAGES_DELIVERY_URL = 'https://delivery.example/account/'
    config.CLOUDFLARE_IMAGES_VARIANT = 'square'
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        pending_asset_id: 'asset-new',
        current_asset_id: 'asset-old',
      }] as never)
      .mockResolvedValueOnce([approvedStateRow('https://delivery.example/account/asset-new/square')] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(providerSuccess({
        id: 'asset-new',
        variants: ['https://fallback.example/asset-new/public'],
        metadata: { citizen_id: CITIZEN_ID },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-new')).resolves.toEqual({
      citizen_id: CITIZEN_ID,
      avatar_url: 'https://delivery.example/account/asset-new/square',
      status: 'approved',
      updated_at: '2026-09-07T18:00:00.000Z',
      upload_enabled: true,
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1]?.[0]).toContain('/images/v1/asset-old')
  })

  it('confirms an upload using the first public provider variant when no delivery base is configured', async () => {
    enableProvider()
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        pending_asset_id: 'asset-1',
        current_asset_id: null,
      }] as never)
      .mockResolvedValueOnce([approvedStateRow('https://images.example/asset-1/public')] as never)
    jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(providerSuccess({
      id: 'asset-1',
      variants: ['internal://private', 'https://images.example/asset-1/public'],
      metadata: {},
    }))

    await expect(confirmCivicAvatarUpload(CITIZEN_ID, 'asset-1')).resolves.toMatchObject({
      avatar_url: 'https://images.example/asset-1/public',
      upload_enabled: true,
    })
    expect(querySpy).toHaveBeenCalledTimes(2)
  })

  it('rejects avatar removal for a missing civic profile', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([] as never)

    await expect(removeCivicAvatar(CITIZEN_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  })

  it('clears database references before best-effort provider cleanup and returns missing state', async () => {
    enableProvider()
    const querySpy = jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([{
        current_asset_id: 'asset-current',
        pending_asset_id: 'asset-pending',
      }] as never)
      .mockResolvedValueOnce([{
        citizen_id: CITIZEN_ID,
        civic_avatar_url: null,
        civic_avatar_status: 'missing',
        civic_avatar_updated_at: null,
      }] as never)
    const executeSpy = jest.spyOn(prisma, '$executeRaw').mockResolvedValueOnce(1 as never)
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    await expect(removeCivicAvatar(CITIZEN_ID)).resolves.toEqual({
      citizen_id: CITIZEN_ID,
      avatar_url: null,
      status: 'missing',
      updated_at: null,
      upload_enabled: true,
    })
    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(querySpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

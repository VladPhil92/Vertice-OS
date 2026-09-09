import { config } from '../../config'

export type MediaPurpose = 'civic_profile_avatar' | 'territorial_report_evidence'

interface CloudflareEnvelope<T> {
  success: boolean
  errors?: Array<{ code?: number; message?: string }>
  result?: T
}

interface CloudflareUploadIntent {
  id: string
  uploadURL: string
}

export interface ProviderImageAsset {
  id: string
  variants?: string[]
  metadata?: Record<string, unknown>
}

export function isImageProviderReady(): boolean {
  return Boolean(
    config.CLOUDFLARE_IMAGES_ACCOUNT_ID
    && config.CLOUDFLARE_IMAGES_API_TOKEN,
  )
}

function providerBaseUrl(): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_IMAGES_ACCOUNT_ID}`
}

function providerHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${config.CLOUDFLARE_IMAGES_API_TOKEN}` }
}

function requireProvider(): void {
  if (!isImageProviderReady()) {
    throw Object.assign(new Error('El almacenamiento de imágenes no está disponible temporalmente.'), {
      statusCode: 503,
      code: 'MEDIA_STORAGE_UNAVAILABLE',
    })
  }
}

async function parseProviderResponse<T>(response: Response): Promise<T> {
  let body: CloudflareEnvelope<T>
  try {
    body = await response.json() as CloudflareEnvelope<T>
  } catch {
    throw Object.assign(new Error('El proveedor de imágenes devolvió una respuesta inválida.'), {
      statusCode: 502,
      code: 'MEDIA_PROVIDER_INVALID_RESPONSE',
    })
  }

  if (!response.ok || !body.success || !body.result) {
    throw Object.assign(new Error(body.errors?.[0]?.message || 'No fue posible procesar la imagen.'), {
      statusCode: 502,
      code: 'MEDIA_PROVIDER_ERROR',
    })
  }

  return body.result
}

export async function createDirectImageUpload(
  citizenId: string,
  purpose: MediaPurpose,
): Promise<{ provider_asset_id: string; upload_url: string }> {
  requireProvider()

  const form = new FormData()
  form.set('requireSignedURLs', 'false')
  form.set('metadata', JSON.stringify({ citizen_id: citizenId, purpose }))

  const response = await fetch(`${providerBaseUrl()}/images/v2/direct_upload`, {
    method: 'POST',
    headers: providerHeaders(),
    body: form,
  })
  const intent = await parseProviderResponse<CloudflareUploadIntent>(response)

  if (!intent.id || !intent.uploadURL) {
    throw Object.assign(new Error('El proveedor no generó una sesión de carga válida.'), {
      statusCode: 502,
      code: 'MEDIA_UPLOAD_INTENT_INVALID',
    })
  }

  return { provider_asset_id: intent.id, upload_url: intent.uploadURL }
}

export async function inspectImageAsset(assetId: string): Promise<ProviderImageAsset> {
  requireProvider()
  const response = await fetch(`${providerBaseUrl()}/images/v1/${encodeURIComponent(assetId)}`, {
    headers: providerHeaders(),
  })
  return parseProviderResponse<ProviderImageAsset>(response)
}

export function resolveImageDeliveryUrl(image: ProviderImageAsset): string | null {
  const configuredDelivery = config.CLOUDFLARE_IMAGES_DELIVERY_URL
    ? `${config.CLOUDFLARE_IMAGES_DELIVERY_URL.replace(/\/$/, '')}/${encodeURIComponent(image.id)}/${config.CLOUDFLARE_IMAGES_VARIANT}`
    : null

  return configuredDelivery
    ?? image.variants?.find((variant) => variant.startsWith('https://'))
    ?? null
}

export async function deleteImageAsset(assetId: string): Promise<void> {
  if (!isImageProviderReady() || !assetId) return
  try {
    await fetch(`${providerBaseUrl()}/images/v1/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
      headers: providerHeaders(),
    })
  } catch {
    // Ordinary UI cleanup remains best-effort. Privacy erasure uses
    // purgeImageAssetStrict() so failures enter the durable job retry path.
  }
}

/**
 * Strict deletion used by privacy/account-erasure jobs. Unlike normal media
 * replacement cleanup, this function must fail closed so the jobs worker keeps
 * retrying instead of falsely certifying that an external biometric-like image
 * has been purged.
 */
export async function purgeImageAssetStrict(assetId: string): Promise<void> {
  if (!assetId) return
  requireProvider()

  const response = await fetch(`${providerBaseUrl()}/images/v1/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
    headers: providerHeaders(),
  })

  if (response.status === 404) return
  if (!response.ok) {
    throw Object.assign(new Error(`No fue posible eliminar el activo externo (${response.status}).`), {
      statusCode: 502,
      code: 'MEDIA_PROVIDER_DELETE_FAILED',
    })
  }
}

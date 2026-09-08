import { config } from '../../config'
import { prisma } from '../../lib/prisma'

const PROVIDER = 'ctg_one'
const CTG_ONE_PROVISION_URL = 'https://ctgone.com/api/federation/vertice/provision'
const PROVISION_TIMEOUT_MS = 5_000
const VERIFIED_CONTACT_LEVEL = 2

type ProvisionResponse = {
  status?: unknown
  redirect_url?: unknown
  error?: unknown
  message?: unknown
}

function federationError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function validHttpsRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export async function provisionCtgOneForCitizen(citizenId: string): Promise<{
  status: string
  redirect_url: string
}> {
  const citizen = await prisma.citizen.findUnique({
    where: { id: citizenId },
    select: { id: true, email: true, verificationLevel: true, isActive: true },
  })

  if (!citizen || !citizen.isActive) {
    throw federationError('Cuenta VÉRTICE inactiva', 403, 'ACCOUNT_INACTIVE')
  }

  const externalIdentity = await prisma.externalIdentity.findFirst({
    where: { citizenId: citizen.id, provider: PROVIDER },
    select: { providerSubject: true },
  })

  // VÉRTICE defines verificationLevel >= 2 as verified contact. A native VÉRTICE
  // account cannot bootstrap a confirmed CTG One email below that assurance floor.
  // Accounts that originated in CTG One carry the canonical CTG subject instead;
  // CTG One re-validates that subject and its own confirmed email server-side.
  const hasCanonicalCtgSubject = Boolean(externalIdentity?.providerSubject)
  if (!hasCanonicalCtgSubject && citizen.verificationLevel < VERIFIED_CONTACT_LEVEL) {
    throw federationError(
      'Verifica tu contacto en VÉRTICE antes de crear tu cuenta CTG One desde esta plataforma',
      403,
      'VERIFIED_IDENTITY_REQUIRED',
    )
  }

  const secret = config.CTG_ONE_FEDERATION_SECRET?.trim()
  if (!secret) {
    throw federationError(
      'La conexión con CTG One no está configurada',
      503,
      'CTG_ONE_FEDERATION_NOT_CONFIGURED',
    )
  }

  let response: Response
  try {
    response = await fetch(CTG_ONE_PROVISION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ctg-federation-secret': secret,
      },
      body: JSON.stringify({
        provider_subject: citizen.id,
        ctg_subject: externalIdentity?.providerSubject ?? null,
        email: citizen.email.trim().toLowerCase(),
        email_verified: hasCanonicalCtgSubject || citizen.verificationLevel >= VERIFIED_CONTACT_LEVEL,
        assurance_level: Math.max(0, Math.min(4, citizen.verificationLevel)),
      }),
      signal: AbortSignal.timeout(PROVISION_TIMEOUT_MS),
    })
  } catch {
    throw federationError('CTG One no está disponible', 503, 'CTG_ONE_FEDERATION_UNAVAILABLE')
  }

  let body: ProvisionResponse = {}
  try {
    body = await response.json() as ProvisionResponse
  } catch {
    // Invalid remote responses are rejected below.
  }

  const remoteCode = typeof body.error === 'string' ? body.error : ''
  if (!response.ok) {
    if (response.status === 409 && remoteCode === 'FEDERATION_LINK_REQUIRED') {
      throw federationError(
        typeof body.message === 'string'
          ? body.message
          : 'Ya existe una cuenta CTG One con ese correo; debes vincularla explícitamente desde CTG One',
        409,
        'CTG_ONE_LINK_REQUIRED',
      )
    }
    if (response.status === 403 && remoteCode === 'ECOSYSTEM_LINK_INACTIVE') {
      throw federationError('El vínculo con CTG One está inactivo', 403, 'CTG_ONE_LINK_INACTIVE')
    }
    throw federationError('No fue posible conectar con CTG One', 503, remoteCode || 'CTG_ONE_PROVISION_FAILED')
  }

  const redirectUrl = validHttpsRedirect(body.redirect_url)
  if (!redirectUrl || typeof body.status !== 'string') {
    throw federationError('Respuesta inválida de CTG One', 502, 'INVALID_CTG_ONE_PROVISION_RESPONSE')
  }

  return { status: body.status, redirect_url: redirectUrl }
}

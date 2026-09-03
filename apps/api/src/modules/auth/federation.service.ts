import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import type { AccessTokenPayload, CitizenRole } from '../../lib/jwt'
import { generateRefreshToken, hashToken, refreshTokenExpiresAt } from '../../lib/jwt'
import type { AuthTokenResponse } from './auth.types'
import {
  bootstrapFederatedSuperadmin,
  ensureBaselineRoleGrants,
  setSessionActiveRole,
} from './roles.service'

const SOURCE_PROVIDER = 'ctg_one'
const TARGET_PROVIDER = 'vertice'
const EXCHANGE_TIMEOUT_MS = 5_000
const SUBJECT_PATTERN = /^[0-9a-f-]{36}$/i
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/
const FEDERATION_PROBE_CODE = 'A'.repeat(43)
const FEDERATION_PROBE_VERIFIER = 'B'.repeat(43)

export type FederationExchangeInput = {
  code: string
  code_verifier: string
}

type CtgOneFederationIdentity = {
  provider?: unknown
  subject?: unknown
  email?: unknown
  email_verified?: unknown
  authorities?: unknown
}

type RemoteFederationError = {
  error?: unknown
}

export type FederationProbeState =
  | 'ready'
  | 'local_unconfigured'
  | 'remote_unconfigured'
  | 'secret_mismatch'
  | 'unavailable'
  | 'unexpected_response'

export type FederationProbeResult = {
  status: FederationProbeState
  remote_status?: number
}

function federationError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code })
}

function normalizeInput(input: FederationExchangeInput): FederationExchangeInput {
  if (!CODE_PATTERN.test(input.code) || !VERIFIER_PATTERN.test(input.code_verifier)) {
    throw federationError('Solicitud de federación inválida', 400, 'INVALID_FEDERATION_REQUEST')
  }
  return input
}

function normalizeIdentity(raw: CtgOneFederationIdentity): {
  subject: string
  email: string
  authorities: string[]
} {
  const provider = raw.provider
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : ''
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  const authorities = Array.isArray(raw.authorities)
    ? raw.authorities.filter((value): value is string => typeof value === 'string')
    : []

  if (
    provider !== TARGET_PROVIDER
    || !SUBJECT_PATTERN.test(subject)
    || !email
    || email.length > 320
    || !email.includes('@')
    || raw.email_verified !== true
  ) {
    throw federationError('Identidad federada inválida', 502, 'INVALID_FEDERATION_IDENTITY')
  }

  return { subject, email, authorities }
}

async function remoteErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as RemoteFederationError
    return typeof body.error === 'string' ? body.error : undefined
  } catch {
    return undefined
  }
}

function federationHeaders(secret: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-ctg-federation-secret': secret,
  }
}

/**
 * Non-destructive production canary for the CTG One trust contract.
 *
 * It submits a syntactically valid but deliberately nonexistent PKCE code. A
 * healthy CTG One exchange must authenticate the service secret first and then
 * reject the fake code with INVALID_OR_EXPIRED_CODE. No real authorization
 * code can be consumed by this probe.
 */
export async function probeCtgOneFederation(): Promise<FederationProbeResult> {
  const secret = config.CTG_ONE_FEDERATION_SECRET?.trim()
  if (!secret) return { status: 'local_unconfigured' }

  let response: Response
  try {
    response = await fetch(config.CTG_ONE_FEDERATION_EXCHANGE_URL, {
      method: 'POST',
      headers: federationHeaders(secret),
      body: JSON.stringify({
        code: FEDERATION_PROBE_CODE,
        code_verifier: FEDERATION_PROBE_VERIFIER,
      }),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
  } catch {
    return { status: 'unavailable' }
  }

  const code = await remoteErrorCode(response)
  if (response.status === 401 && code === 'INVALID_OR_EXPIRED_CODE') {
    return { status: 'ready', remote_status: response.status }
  }
  if (response.status === 401 && code === 'UNAUTHORIZED') {
    return { status: 'secret_mismatch', remote_status: response.status }
  }
  if (response.status === 503 && code === 'FEDERATION_SECRET_NOT_CONFIGURED') {
    return { status: 'remote_unconfigured', remote_status: response.status }
  }
  if (response.status === 503) {
    return { status: 'unavailable', remote_status: response.status }
  }
  return { status: 'unexpected_response', remote_status: response.status }
}

async function exchangeWithCtgOne(input: FederationExchangeInput) {
  const secret = config.CTG_ONE_FEDERATION_SECRET?.trim()
  if (!secret) {
    throw federationError(
      'Federación con CTG One no configurada',
      503,
      'CTG_ONE_FEDERATION_NOT_CONFIGURED',
    )
  }

  let response: Response
  try {
    response = await fetch(config.CTG_ONE_FEDERATION_EXCHANGE_URL, {
      method: 'POST',
      headers: federationHeaders(secret),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
  } catch {
    throw federationError('CTG One no disponible', 503, 'CTG_ONE_FEDERATION_UNAVAILABLE')
  }

  if (!response.ok) {
    const code = await remoteErrorCode(response)

    if (response.status === 401 && code === 'UNAUTHORIZED') {
      throw federationError(
        'La credencial de federación fue rechazada por CTG One',
        503,
        'CTG_ONE_FEDERATION_SECRET_MISMATCH',
      )
    }
    if (response.status === 400 || response.status === 401) {
      throw federationError('Código federado inválido o expirado', 401, 'INVALID_FEDERATION_CODE')
    }
    if (response.status === 503 && code === 'FEDERATION_SECRET_NOT_CONFIGURED') {
      throw federationError(
        'CTG One no tiene configurado el contrato de federación',
        503,
        'CTG_ONE_FEDERATION_REMOTE_NOT_CONFIGURED',
      )
    }
    if (response.status === 503 && code === 'FEDERATION_AUTHORITY_LOOKUP_FAILED') {
      throw federationError(
        'CTG One no pudo validar la autoridad federada',
        503,
        'CTG_ONE_FEDERATION_AUTHORITY_UNAVAILABLE',
      )
    }
    throw federationError('CTG One no disponible', 503, 'CTG_ONE_FEDERATION_UNAVAILABLE')
  }

  let body: CtgOneFederationIdentity
  try {
    body = await response.json() as CtgOneFederationIdentity
  } catch {
    throw federationError('Respuesta federada inválida', 502, 'INVALID_FEDERATION_IDENTITY')
  }

  return normalizeIdentity(body)
}

async function resolveCitizen(subject: string, email: string) {
  const existingIdentity = await prisma.externalIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: SOURCE_PROVIDER,
        providerSubject: subject,
      },
    },
    include: {
      citizen: {
        select: {
          id: true,
          did: true,
          email: true,
          verificationLevel: true,
          role: true,
          isActive: true,
        },
      },
    },
  })

  if (existingIdentity) {
    if (!existingIdentity.citizen.isActive) {
      throw federationError('Cuenta VÉRTICE inactiva', 403, 'FEDERATED_ACCOUNT_INACTIVE')
    }

    await prisma.externalIdentity.update({
      where: { id: existingIdentity.id },
      data: { lastLoginAt: new Date(), emailAtLink: email },
    })
    return existingIdentity.citizen
  }

  const emailCollision = await prisma.citizen.findUnique({
    where: { email },
    select: { id: true },
  })
  if (emailCollision) {
    throw federationError(
      'Ya existe una cuenta VÉRTICE con este correo; vincúlala antes de usar CTG One',
      409,
      'FEDERATION_LINK_REQUIRED',
    )
  }

  const id = crypto.randomUUID()
  const did = `did:vertice:${id}`

  try {
    return await prisma.$transaction(async (tx) => {
      const citizen = await tx.citizen.create({
        data: {
          id,
          did,
          cedulaHash: null,
          email,
          passwordHash: null,
          verificationLevel: 0,
          role: 'citizen',
          lastActiveAt: new Date(),
        },
        select: {
          id: true,
          did: true,
          email: true,
          verificationLevel: true,
          role: true,
          isActive: true,
        },
      })

      await tx.externalIdentity.create({
        data: {
          provider: SOURCE_PROVIDER,
          providerSubject: subject,
          citizenId: citizen.id,
          emailAtLink: email,
          lastLoginAt: new Date(),
        },
      })

      return citizen
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw federationError(
        'La identidad federada cambió durante el enlace; intenta de nuevo',
        409,
        'FEDERATION_LINK_RACE',
      )
    }
    throw error
  }
}

export async function exchangeCtgOneFederation(
  app: FastifyInstance,
  rawInput: FederationExchangeInput,
  meta: { userAgent?: string; ipAddress?: string },
): Promise<AuthTokenResponse & { refresh_token: string }> {
  const input = normalizeInput(rawInput)
  const identity = await exchangeWithCtgOne(input)
  const citizen = await resolveCitizen(identity.subject, identity.email)

  const bootstrappedRole = await bootstrapFederatedSuperadmin(citizen.id, identity.authorities)
  const preferredRole = bootstrappedRole ?? ((citizen.role as CitizenRole) ?? 'citizen')
  const activeRole = await ensureBaselineRoleGrants(citizen.id, preferredRole)

  const refreshToken = generateRefreshToken()
  const session = await prisma.session.create({
    data: {
      citizenId: citizen.id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
    select: { id: true },
  })
  await setSessionActiveRole(session.id, citizen.id, activeRole)
  await prisma.citizen.update({ where: { id: citizen.id }, data: { lastActiveAt: new Date() } })

  const payload: AccessTokenPayload = {
    sub: citizen.id,
    did: citizen.did,
    lvl: citizen.verificationLevel,
    role: activeRole,
    sid: session.id,
  }
  const accessToken = app.jwt.sign(payload, { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
    citizen_id: citizen.id,
    refresh_token: refreshToken,
  }
}

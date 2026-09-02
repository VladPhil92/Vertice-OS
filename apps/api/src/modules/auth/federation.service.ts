import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import type { FastifyInstance } from 'fastify'

import { config } from '../../config'
import { prisma } from '../../lib/prisma'
import type { AccessTokenPayload, CitizenRole } from '../../lib/jwt'
import { generateRefreshToken, hashToken, refreshTokenExpiresAt } from '../../lib/jwt'
import type { AuthTokenResponse } from './auth.types'

const SOURCE_PROVIDER = 'ctg_one'
const TARGET_PROVIDER = 'vertice'
const EXCHANGE_TIMEOUT_MS = 5_000
const SUBJECT_PATTERN = /^[0-9a-f-]{36}$/i
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/

export type FederationExchangeInput = {
  code: string
  code_verifier: string
}

type CtgOneFederationIdentity = {
  provider?: unknown
  subject?: unknown
  email?: unknown
  email_verified?: unknown
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
} {
  const provider = raw.provider
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : ''
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''

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

  return { subject, email }
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
      headers: {
        'Content-Type': 'application/json',
        'x-ctg-federation-secret': secret,
      },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
  } catch {
    throw federationError('CTG One no disponible', 503, 'CTG_ONE_FEDERATION_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw federationError('Código federado inválido o expirado', 401, 'INVALID_FEDERATION_CODE')
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

  // Email equality is not sufficient proof of account ownership. A local
  // account must be linked through an explicit authenticated linking flow.
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

  const payload: AccessTokenPayload = {
    sub: citizen.id,
    did: citizen.did,
    lvl: citizen.verificationLevel,
    role: (citizen.role as CitizenRole) ?? 'citizen',
  }

  const accessToken = app.jwt.sign(payload, { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS })
  const refreshToken = generateRefreshToken()

  await prisma.$transaction([
    prisma.session.create({
      data: {
        citizenId: citizen.id,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    }),
    prisma.citizen.update({
      where: { id: citizen.id },
      data: { lastActiveAt: new Date() },
    }),
  ])

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
    citizen_id: citizen.id,
    refresh_token: refreshToken,
  }
}

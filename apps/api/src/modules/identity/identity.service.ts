import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { getCache, delCache, TTL } from '../../lib/cache'
import { config } from '../../config'
import { sendEmailVerification } from '../../lib/email'
import type { DIDDocument, VerificationStatus } from './identity.types'
import type { UpdateProfileInput } from './identity.schema'

// ── Constantes ────────────────────────────────────────────────────────────────

const EMAIL_VERIFY_PREFIX = 'vertice:email_verify'
const EMAIL_VERIFY_TTL = 15 * 60 // 15 minutos

const LEVEL_NAMES: VerificationStatus['level_name'][] = [
  'registrado',
  'cedula_confirmada',
  'identidad_completa',
]

// ── Helpers privados ──────────────────────────────────────────────────────────

function emailVerifyKey(citizenId: string): string {
  return `${EMAIL_VERIFY_PREFIX}:${citizenId}`
}

function hashCedula(cedula: string): string {
  return crypto.createHash('sha256').update(cedula).digest('hex')
}

function buildDIDDocument(citizen: {
  id: string
  did: string
  verificationLevel: number
  localityId: number | null
  createdAt: Date
  lastActiveAt: Date | null
}): DIDDocument {
  const base = process.env.API_URL ?? 'http://localhost:4000'
  // Clave pública derivada del UUID — placeholder hasta integración Polygon
  const publicKeyMultibase = `z${Buffer.from(citizen.id.replace(/-/g, ''), 'hex').toString('base64url')}`

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: citizen.did,
    controller: citizen.did,
    verificationMethod: [
      {
        id: `${citizen.did}#keys-1`,
        type: 'Ed25519VerificationKey2020',
        controller: citizen.did,
        publicKeyMultibase,
      },
    ],
    authentication: [`${citizen.did}#keys-1`],
    service: [
      {
        id: `${citizen.did}#civic-profile`,
        type: 'CivicProfile',
        serviceEndpoint: `${base}/identity/did/${citizen.did}`,
      },
    ],
    created: citizen.createdAt.toISOString(),
    updated: (citizen.lastActiveAt ?? citizen.createdAt).toISOString(),
    verificationLevel: citizen.verificationLevel,
  }
}

function buildVerificationStatus(citizen: {
  id: string
  did: string
  verificationLevel: number
}): VerificationStatus {
  const level = Math.min(citizen.verificationLevel, 2) as 0 | 1 | 2
  return {
    citizen_id: citizen.id,
    did: citizen.did,
    level,
    level_name: LEVEL_NAMES[level],
    can_vote: level >= 1,
    can_propose: level >= 2,
  }
}

// ── Resolución de DID ─────────────────────────────────────────────────────────

export async function resolveDID(did: string): Promise<DIDDocument> {
  // DID es un identificador estable — se puede cachear
  const cacheKey = `did:${did}`
  const cached = await getCache<DIDDocument>('did_doc', cacheKey)
  if (cached) return cached

  const citizen = await prisma.citizen.findUnique({
    where: { did },
    select: { id: true, did: true, verificationLevel: true, localityId: true, createdAt: true, lastActiveAt: true },
  })

  if (!citizen) {
    throw Object.assign(new Error('DID no encontrado'), { statusCode: 404, code: 'DID_NOT_FOUND' })
  }

  const doc = buildDIDDocument(citizen)
  // TTL corto — el nivel de verificación puede cambiar
  await redis.set(`vertice:did_doc:${did}`, JSON.stringify(doc), 'EX', 60)
  return doc
}

export async function getOwnDIDDocument(citizenId: string): Promise<DIDDocument> {
  const citizen = await prisma.citizen.findUniqueOrThrow({
    where: { id: citizenId },
    select: { id: true, did: true, verificationLevel: true, localityId: true, createdAt: true, lastActiveAt: true },
  })
  return buildDIDDocument(citizen)
}

export async function getVerificationStatus(citizenId: string): Promise<VerificationStatus> {
  const citizen = await prisma.citizen.findUniqueOrThrow({
    where: { id: citizenId },
    select: { id: true, did: true, verificationLevel: true },
  })
  return buildVerificationStatus(citizen)
}

// ── Verificación de cédula (nivel 0 → 1) ──────────────────────────────────────

export async function confirmCedula(citizenId: string, cedula: string): Promise<VerificationStatus> {
  const citizen = await prisma.citizen.findUniqueOrThrow({
    where: { id: citizenId },
    select: { id: true, did: true, cedulaHash: true, verificationLevel: true },
  })

  if (citizen.verificationLevel >= 1) {
    throw Object.assign(new Error('Cédula ya confirmada'), { statusCode: 409, code: 'ALREADY_VERIFIED' })
  }

  const inputHash = hashCedula(cedula)
  if (inputHash !== citizen.cedulaHash) {
    // Mismo mensaje para hash incorrecto y cédula errónea — previene enumeración
    throw Object.assign(new Error('La cédula no coincide con el registro'), {
      statusCode: 400,
      code: 'CEDULA_MISMATCH',
    })
  }

  const updated = await prisma.citizen.update({
    where: { id: citizenId },
    data: { verificationLevel: 1, lastActiveAt: new Date() },
    select: { id: true, did: true, verificationLevel: true },
  })

  // Invalidar cache de perfil — el nivel cambió
  await delCache('profile', citizenId)

  return buildVerificationStatus(updated)
}

// ── Verificación de email (nivel 1 → 2) ───────────────────────────────────────

export async function requestEmailVerification(citizenId: string): Promise<{
  message: string
  token?: string
}> {
  const citizen = await prisma.citizen.findUniqueOrThrow({
    where: { id: citizenId },
    select: { email: true, verificationLevel: true },
  })

  if (!citizen.email) {
    throw Object.assign(new Error('El ciudadano no tiene email registrado'), {
      statusCode: 400,
      code: 'NO_EMAIL',
    })
  }

  if (citizen.verificationLevel < 1) {
    throw Object.assign(new Error('Debe confirmar su cédula primero'), {
      statusCode: 422,
      code: 'CEDULA_NOT_CONFIRMED',
    })
  }

  if (citizen.verificationLevel >= 2) {
    throw Object.assign(new Error('Email ya verificado'), { statusCode: 409, code: 'ALREADY_VERIFIED' })
  }

  const token = crypto.randomBytes(32).toString('hex')
  await redis.set(emailVerifyKey(citizenId), token, 'EX', EMAIL_VERIFY_TTL)

  await sendEmailVerification(citizen.email, token)

  if (config.NODE_ENV === 'production') {
    return { message: 'Token enviado al email registrado' }
  }
  // Dev: also return token in response so developers can test without email
  return { message: 'Token enviado al email registrado (modo desarrollo)', token }
}

export async function confirmEmail(citizenId: string, token: string): Promise<VerificationStatus> {
  const stored = await redis.get(emailVerifyKey(citizenId))

  if (!stored || stored !== token) {
    throw Object.assign(new Error('Token inválido o expirado'), {
      statusCode: 400,
      code: 'INVALID_TOKEN',
    })
  }

  const updated = await prisma.citizen.update({
    where: { id: citizenId },
    data: { verificationLevel: 2, lastActiveAt: new Date() },
    select: { id: true, did: true, verificationLevel: true },
  })

  await redis.del(emailVerifyKey(citizenId))
  await delCache('profile', citizenId)

  return buildVerificationStatus(updated)
}

// ── Perfil territorial ────────────────────────────────────────────────────────

export async function updateCitizenProfile(citizenId: string, input: UpdateProfileInput): Promise<void> {
  await prisma.citizen.update({
    where: { id: citizenId },
    data: {
      ...(input.neighborhood !== undefined && { neighborhood: input.neighborhood }),
      ...(input.locality_id !== undefined && { localityId: input.locality_id }),
      lastActiveAt: new Date(),
    },
  })
  await delCache('profile', citizenId)
}

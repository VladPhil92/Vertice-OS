import crypto from 'crypto'
import { verifyMessage } from 'ethers'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { getCache, delCache, TTL } from '../../lib/cache'
import { config } from '../../config'
import { logger } from '../../lib/logger'
import { sendEmailVerification } from '../../lib/email'
import { hashCedula } from '../../lib/identity-hash'
import {
  isValidWalletAddress,
  mintCitizenBadge,
  buildCitizenBadgeURI,
} from '../../lib/blockchain'
import type { DIDDocument, VerificationStatus, VerificationLevel } from './identity.types'
import type { UpdateProfileInput, ConnectWalletInput } from './identity.schema'

// ── Constantes ────────────────────────────────────────────────────────────────

const EMAIL_VERIFY_PREFIX = 'vertice:email_verify'
const EMAIL_VERIFY_TTL = 15 * 60 // 15 minutos

const WALLET_NONCE_PREFIX = 'vertice:wallet_nonce'
const WALLET_NONCE_TTL = 10 * 60 // 10 minutos — ventana corta, de un solo uso

const LEVEL_NAMES: VerificationStatus['level_name'][] = [
  'registrado',
  'documento_declarado',
  'contacto_verificado',
]

// ── Helpers privados ──────────────────────────────────────────────────────────

function emailVerifyKey(citizenId: string): string {
  return `${EMAIL_VERIFY_PREFIX}:${citizenId}`
}

function walletNonceKey(citizenId: string): string {
  return `${WALLET_NONCE_PREFIX}:${citizenId}`
}

/**
 * Mensaje de "Sign-In with Ethereum" simplificado: dominio, ciudadano,
 * dirección a vincular, nonce de un solo uso y fecha de emisión. El
 * ciudadano lo firma desde su wallet para probar que la controla; sin esto,
 * conectar una wallet solo validaba formato y unicidad, así que cualquiera
 * podía copiar la dirección pública de otra persona y reclamarla como propia
 * sin controlarla.
 */
function buildWalletSignInMessage(params: {
  citizenId: string
  walletAddress: string
  nonce: string
}): string {
  const domain = new URL(config.CORS_ORIGIN).host
  return [
    `${domain} quiere que conectes tu wallet a VÉRTICE OS.`,
    '',
    `Ciudadano: ${params.citizenId}`,
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
  ].join('\n')
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

  return {
    // Sin el contexto de ed25519-2020, coherente con no publicar
    // verificationMethod: no hay método criptográfico real que declarar todavía.
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: citizen.did,
    controller: citizen.did,
    service: [
      {
        id: `${citizen.did}#civic-profile`,
        type: 'CivicProfile',
        serviceEndpoint: `${base}/identity/did/${citizen.did}`,
      },
    ],
    created: citizen.createdAt.toISOString(),
    updated: (citizen.lastActiveAt ?? citizen.createdAt).toISOString(),
    verificationLevel: Math.min(citizen.verificationLevel, 2) as VerificationLevel,
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
    select: { id: true, did: true, verificationLevel: true, walletAddress: true },
  })

  await redis.del(emailVerifyKey(citizenId))
  await delCache('profile', citizenId)

  // Si el ciudadano ya tiene wallet conectada, disparar mint del SBT de identidad
  if (updated.walletAddress) {
    triggerIdentityBadgeMint(citizenId, updated.did, updated.walletAddress).catch(() => null)
  }

  return buildVerificationStatus(updated)
}

// ── Wallet Polygon ────────────────────────────────────────────────────────────

/**
 * Genera un nonce de un solo uso para que el ciudadano firme un mensaje de
 * conexión de wallet. Debe llamarse antes de POST /identity/wallet.
 */
export async function requestWalletNonce(
  citizenId: string,
  walletAddress: string,
): Promise<{ message: string }> {
  if (!isValidWalletAddress(walletAddress)) {
    throw Object.assign(new Error('Dirección de wallet inválida'), {
      statusCode: 400,
      code: 'INVALID_WALLET_ADDRESS',
    })
  }

  const nonce = crypto.randomBytes(16).toString('hex')
  await redis.set(walletNonceKey(citizenId), nonce, 'EX', WALLET_NONCE_TTL)

  const message = buildWalletSignInMessage({ citizenId, walletAddress, nonce })
  return { message }
}

/**
 * Conecta una wallet Polygon al perfil del ciudadano.
 * Si el ciudadano ya tiene nivel 2 (identidad completa), dispara el mint del SBT.
 *
 * Requiere una firma del mensaje devuelto por requestWalletNonce() para
 * probar control real de la dirección. Antes solo se comprobaba formato y
 * unicidad: cualquiera podía copiar la dirección pública de otra persona,
 * registrarla primero y bloquear la asociación legítima (o recibir
 * erróneamente un SBT dirigido a esa dirección).
 */
export async function connectWallet(
  citizenId: string,
  input: ConnectWalletInput,
): Promise<{ wallet_address: string; sbt_pending: boolean }> {
  const address = input.wallet_address

  if (!isValidWalletAddress(address)) {
    throw Object.assign(new Error('Dirección de wallet inválida'), {
      statusCode: 400,
      code: 'INVALID_WALLET_ADDRESS',
    })
  }

  const nonceKey = walletNonceKey(citizenId)
  const storedNonce = await redis.get(nonceKey)
  if (!storedNonce) {
    throw Object.assign(
      new Error('Solicita un nuevo mensaje para firmar (el anterior expiró o no existe)'),
      { statusCode: 400, code: 'NONCE_EXPIRED' },
    )
  }

  // Nonce de un solo uso: se consume ANTES de intentar verificar la firma,
  // para que un intento fallido (firma inválida, dirección equivocada) no
  // deje el mismo nonce reutilizable en reintentos.
  await redis.del(nonceKey)

  const expectedMessage = buildWalletSignInMessage({ citizenId, walletAddress: address, nonce: storedNonce })
  let recovered: string
  try {
    recovered = verifyMessage(expectedMessage, input.signature)
  } catch {
    throw Object.assign(new Error('Firma inválida'), { statusCode: 400, code: 'INVALID_SIGNATURE' })
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw Object.assign(
      new Error('La firma no corresponde a la dirección indicada'),
      { statusCode: 400, code: 'SIGNATURE_ADDRESS_MISMATCH' },
    )
  }

  // Verificar que no esté registrada por otro ciudadano
  const conflict = await prisma.citizen.findUnique({
    where: { walletAddress: address },
    select: { id: true },
  })
  if (conflict && conflict.id !== citizenId) {
    throw Object.assign(new Error('Esta wallet ya está registrada en otra cuenta'), {
      statusCode: 409,
      code: 'WALLET_ALREADY_TAKEN',
    })
  }

  const citizen = await prisma.citizen.update({
    where: { id: citizenId },
    data: { walletAddress: address, lastActiveAt: new Date() },
    select: { id: true, did: true, verificationLevel: true, sbtTokenId: true },
  })

  await delCache('profile', citizenId)

  // Mint si el ciudadano tiene nivel 2 y aún no tiene SBT
  const sbtPending = citizen.verificationLevel >= 2 && !citizen.sbtTokenId
  if (sbtPending) {
    triggerIdentityBadgeMint(citizenId, citizen.did, address).catch(() => null)
  }

  return { wallet_address: address, sbt_pending: sbtPending }
}

/**
 * Dispara el mint on-chain del CITIZEN_VERIFIED badge en fire-and-forget.
 * Si el mint tiene éxito, persiste el tokenId en la DB.
 */
async function triggerIdentityBadgeMint(
  citizenId: string,
  did: string,
  walletAddress: string,
): Promise<void> {
  const tokenURI = buildCitizenBadgeURI(did, 2)
  const tokenId  = await mintCitizenBadge(walletAddress, did, tokenURI)

  if (tokenId !== null) {
    await prisma.citizen.update({
      where: { id: citizenId },
      data: { sbtTokenId: tokenId },
    }).catch((err: unknown) => logger.error('[identity] failed to persist sbtTokenId', err))
  }
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

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import type { AccessTokenPayload, CitizenRole } from '../../lib/jwt';
import { generateRefreshToken, hashToken, refreshTokenExpiresAt } from '../../lib/jwt'
import { getCache, setCache, delCache, TTL } from '../../lib/cache'
import { redis } from '../../lib/redis'
import { sendPasswordReset } from '../../lib/email'
import { runCypher } from '../../lib/neo4j'
import { config } from '../../config'
import { logger } from '../../lib/logger'
import { hashCedula } from '../../lib/identity-hash'
import type { RegisterInput, LoginInput } from './auth.schema'
import type { AuthTokenResponse, CitizenPublicProfile } from './auth.types'

const PWD_RESET_PREFIX = 'vertice:pwd_reset'
const PWD_RESET_TTL    = 30 * 60 // 30 minutos

// Hash bcrypt fijo (de una contraseña que nadie tiene) usado únicamente para
// que loginCitizen() tarde lo mismo exista o no el ciudadano. Sin esto, el
// cuerpo de la respuesta es idéntico para "no existe" y "password
// incorrecta" pero el TIEMPO no: sin este hash, bcrypt.compare() se saltaba
// por completo cuando el ciudadano no existía, y esa diferencia (una
// consulta a Postgres vs. bcrypt.compare, que a 12 rondas toma decenas de
// milisegundos) es un canal de temporización — permite enumerar emails
// registrados igual que si el mensaje de error los distinguiera.
const DUMMY_PASSWORD_HASH = '$2b$12$N7QHfr8J/YmthQWHbgBcnO3Nz6gMEjEYV6xl5VAe9TeTAOQOpIjoy'

function generateDid(uuid: string): string {
  return `did:vertice:${uuid}`
}

export async function registerCitizen(input: RegisterInput): Promise<{ citizen_id: string; did: string }> {
  const cedulaHash = hashCedula(input.cedula)

  const existing = await prisma.citizen.findFirst({
    where: { OR: [{ cedulaHash }, { email: input.email }] },
    select: { id: true, cedulaHash: true, email: true },
  })

  if (existing?.cedulaHash === cedulaHash) {
    throw Object.assign(new Error('Cédula ya registrada'), { statusCode: 409, code: 'CEDULA_ALREADY_EXISTS' })
  }
  if (existing?.email === input.email) {
    throw Object.assign(new Error('Email ya registrado'), { statusCode: 409, code: 'EMAIL_ALREADY_EXISTS' })
  }

  const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS)
  const id = crypto.randomUUID()
  const did = generateDid(id)

  const citizen = await prisma.citizen.create({
    data: {
      id,
      did,
      cedulaHash,
      email: input.email,
      passwordHash,
      neighborhood: input.neighborhood,
      localityId: input.locality_id,
    },
    select: { id: true, did: true },
  })

  runCypher(
    'MERGE (c:Citizen {id: $id}) SET c.did = $did, c.createdAt = datetime()',
    { id: citizen.id, did: citizen.did },
  ).catch((err: unknown) => logger.error('[auth] neo4j citizen node failed', err))

  return { citizen_id: citizen.id, did: citizen.did }
}

export async function loginCitizen(
  app: FastifyInstance,
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<AuthTokenResponse & { refresh_token: string }> {
  const citizen = await prisma.citizen.findUnique({
    where: { email: input.email },
    select: { id: true, did: true, passwordHash: true, verificationLevel: true, role: true },
  })

  // Cuerpo Y tiempo de respuesta idénticos para email inexistente y password
  // incorrecta — previene user enumeration. bcrypt.compare() SIEMPRE corre,
  // incluso contra un hash de relleno cuando el ciudadano no existe.
  const passwordMatch = await bcrypt.compare(
    input.password,
    citizen?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )

  if (!citizen || !passwordMatch) {
    throw Object.assign(new Error('Credenciales inválidas'), { statusCode: 401, code: 'INVALID_CREDENTIALS' })
  }

  const payload: AccessTokenPayload = {
    sub: citizen.id,
    did: citizen.did,
    lvl: citizen.verificationLevel,
    role: (citizen.role as CitizenRole) ?? 'citizen',
  }

  const accessToken = app.jwt.sign(payload, { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS })
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashToken(refreshToken)

  await prisma.$transaction([
    prisma.session.create({
      data: {
        citizenId: citizen.id,
        refreshTokenHash,
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

export async function refreshAccessToken(
  app: FastifyInstance,
  rawRefreshToken: string
): Promise<Omit<AuthTokenResponse, 'citizen_id'>> {
  const tokenHash = hashToken(rawRefreshToken)

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { citizen: { select: { id: true, did: true, verificationLevel: true, role: true } } },
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw Object.assign(new Error('Sesión inválida o expirada'), { statusCode: 401, code: 'INVALID_SESSION' })
  }

  const payload: AccessTokenPayload = {
    sub: session.citizen.id,
    did: session.citizen.did,
    lvl: session.citizen.verificationLevel,
    role: (session.citizen.role as CitizenRole) ?? 'citizen',
  }

  const accessToken = app.jwt.sign(payload, { expiresIn: config.JWT_ACCESS_EXPIRY_SECONDS })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
  }
}

export async function revokeSession(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken)

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    select: { citizenId: true },
  })

  await prisma.session.updateMany({
    where: { refreshTokenHash: tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  if (session) {
    await delCache('profile', session.citizenId)
  }
}

export async function getCitizenProfile(citizenId: string): Promise<CitizenPublicProfile> {
  const cached = await getCache<CitizenPublicProfile>('profile', citizenId)
  if (cached) return cached

  const citizen = await prisma.citizen.findUniqueOrThrow({
    where: { id: citizenId },
    select: {
      id: true,
      did: true,
      email: true,
      neighborhood: true,
      localityId: true,
      reputationScore: true,
      verificationLevel: true,
      createdAt: true,
      lastActiveAt: true,
    },
  })

  const profile: CitizenPublicProfile = {
    id: citizen.id,
    did: citizen.did,
    email: citizen.email,
    neighborhood: citizen.neighborhood,
    locality_id: citizen.localityId,
    reputation_score: citizen.reputationScore.toString(),
    verification_level: citizen.verificationLevel,
    created_at: citizen.createdAt,
    last_active_at: citizen.lastActiveAt,
  }

  await setCache('profile', citizenId, profile, TTL.PROFILE)
  return profile
}

// ── Change password (autenticado) ─────────────────────────────────────────────

/**
 * Cambio de contraseña para un ciudadano ya autenticado — no existía ningún
 * camino para esto salvo el flujo de "olvidé mi contraseña" por correo.
 * Exige la contraseña actual (mismo motivo que en login: sin esto, robar un
 * access token de corta vida bastaría para secuestrar la cuenta de forma
 * permanente). Revoca todas las DEMÁS sesiones — la que hizo el cambio sigue
 * viva porque ya demostró conocer tanto la contraseña vieja como la nueva.
 */
export async function changePassword(
  citizenId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken?: string,
): Promise<void> {
  const citizen = await prisma.citizen.findUnique({
    where: { id: citizenId },
    select: { passwordHash: true },
  })

  const currentMatch = await bcrypt.compare(
    currentPassword,
    citizen?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )

  if (!citizen || !currentMatch) {
    throw Object.assign(new Error('Contraseña actual incorrecta'), {
      statusCode: 401,
      code: 'INVALID_CURRENT_PASSWORD',
    })
  }

  const passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS)
  const keepSessionHash = currentRefreshToken ? hashToken(currentRefreshToken) : null

  await prisma.$transaction([
    prisma.citizen.update({
      where: { id: citizenId },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: {
        citizenId,
        revokedAt: null,
        ...(keepSessionHash ? { refreshTokenHash: { not: keepSessionHash } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ])

  await delCache('profile', citizenId)
}

// ── Forgot / reset password ───────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const citizen = await prisma.citizen.findUnique({
    where: { email },
    select: { id: true, email: true },
  })

  // Return silently even if email not found — prevents user enumeration
  if (!citizen?.email) return

  const token = crypto.randomBytes(32).toString('hex')
  await redis.set(`${PWD_RESET_PREFIX}:${token}`, citizen.id, 'EX', PWD_RESET_TTL)
  await sendPasswordReset(citizen.email, token)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  // GETDEL consume el token atómicamente en una sola ida a Redis — antes era
  // GET seguido de DEL después de la transacción de Postgres, dejando el
  // token vigente (reutilizable dentro de su TTL de 30 min) durante toda esa
  // ventana, e incluso de forma permanente si la transacción fallaba a mitad
  // de camino (el DEL nunca llegaba a ejecutarse). Con GETDEL, dos
  // solicitudes concurrentes con el mismo token — o un reintento tras un
  // error real — nunca pueden consumirlo dos veces.
  const citizenId = await redis.getdel(`${PWD_RESET_PREFIX}:${token}`)
  if (!citizenId) {
    throw Object.assign(new Error('Token inválido o expirado'), {
      statusCode: 400,
      code: 'INVALID_RESET_TOKEN',
    })
  }

  const passwordHash = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS)

  await prisma.$transaction([
    prisma.citizen.update({
      where: { id: citizenId },
      data: { passwordHash },
    }),
    // Revoke all active sessions — force re-login everywhere
    prisma.session.updateMany({
      where: { citizenId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await delCache('profile', citizenId)
}

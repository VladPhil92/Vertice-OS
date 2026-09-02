import type { FastifyInstance } from 'fastify'
import { requireAuth, requireVerified } from '../../middleware/auth'
import { ConfirmCedulaSchema, ConfirmEmailTokenSchema, UpdateProfileSchema, ConnectWalletSchema } from './identity.schema'
import { z } from 'zod'
import {
  resolveDID,
  getOwnDIDDocument,
  getVerificationStatus,
  confirmCedula,
  requestEmailVerification,
  confirmEmail,
  updateCitizenProfile,
  connectWallet,
  requestWalletNonce,
} from './identity.service'
import { getCivicIdentityAssurance } from './identity-assurance.service'

const WalletNonceSchema = z.object({
  wallet_address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Dirección de wallet inválida'),
})

const DID_CONTENT_TYPE = 'application/did+ld+json'

export async function identityRoutes(app: FastifyInstance): Promise<void> {
  // ── Resolución pública ────────────────────────────────────────────────────

  // GET /identity/did/:did — resuelve un DID Document (endpoint público, sin auth)
  app.get('/did/:did', async (request, reply) => {
    const { did } = request.params as { did: string }

    if (!did.startsWith('did:vertice:')) {
      return reply.status(400).send({ error: 'Método DID no soportado', code: 'UNSUPPORTED_DID_METHOD' })
    }

    const doc = await resolveDID(did)
    reply.header('Content-Type', DID_CONTENT_TYPE)
    return reply.send(doc)
  })

  // ── Identidad propia ──────────────────────────────────────────────────────

  // GET /identity/me — DID Document completo del ciudadano autenticado
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const doc = await getOwnDIDDocument(request.citizen.sub)
    reply.header('Content-Type', DID_CONTENT_TYPE)
    return reply.send(doc)
  })

  // GET /identity/status — nivel de verificación y capacidades legacy.
  // `verification_level` sigue describiendo controles internos (documento
  // declarado/contacto), no prueba externa de identidad.
  app.get('/status', { preHandler: requireAuth }, async (request, reply) => {
    const status = await getVerificationStatus(request.citizen.sub)
    return reply.send(status)
  })

  // GET /identity/assurance — frontera explícita entre login/contacto e
  // identidad cívica apta para acciones de gobernanza. Solo proveedores
  // incluidos en CIVIC_IDENTITY_ASSURANCE_PROVIDERS pueden elevar este estado.
  app.get('/assurance', { preHandler: requireAuth }, async (request, reply) => {
    const assurance = await getCivicIdentityAssurance(request.citizen.sub)
    return reply.send(assurance)
  })

  // ── Verificación de cédula (nivel 0 → 1) ─────────────────────────────────

  // POST /identity/verify/cedula — re-ingresar cédula para confirmar identidad
  app.post('/verify/cedula', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConfirmCedulaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const status = await confirmCedula(request.citizen.sub, parsed.data.cedula)
    return reply.send({
      message: 'Cédula confirmada — nivel de verificación actualizado a 1',
      ...status,
    })
  })

  // ── Verificación de email (nivel 1 → 2) ──────────────────────────────────

  // POST /identity/verify/email — solicitar token de verificación
  app.post('/verify/email', {
    preHandler: requireVerified, // requiere lvl >= 1 (cédula confirmada)
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const result = await requestEmailVerification(request.citizen.sub)
    return reply.send(result)
  })

  // POST /identity/verify/email/confirm — confirmar token recibido
  app.post('/verify/email/confirm', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConfirmEmailTokenSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Token inválido', details: parsed.error.flatten().fieldErrors })
    }

    const status = await confirmEmail(request.citizen.sub, parsed.data.token)
    return reply.send({
      message: 'Email verificado — nivel de verificación actualizado a 2',
      ...status,
    })
  })

  // ── Perfil territorial ────────────────────────────────────────────────────

  // PUT /identity/profile — actualizar barrio y/o localidad
  app.put('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    await updateCitizenProfile(request.citizen.sub, parsed.data)
    return reply.send({ message: 'Perfil territorial actualizado' })
  })

  // ── Wallet Polygon ────────────────────────────────────────────────────────

  // POST /identity/wallet/nonce — obtiene el mensaje a firmar antes de conectar
  app.post('/wallet/nonce', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = WalletNonceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await requestWalletNonce(request.citizen.sub, parsed.data.wallet_address)
    return reply.send(result)
  })

  // POST /identity/wallet — conectar billetera Polygon para recibir SBT.
  // Requiere `signature` del mensaje devuelto por POST /identity/wallet/nonce.
  app.post('/wallet', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const parsed = ConnectWalletSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    const result = await connectWallet(request.citizen.sub, parsed.data)
    return reply.send({
      message: result.sbt_pending
        ? 'Wallet conectada — badge de identidad siendo emitido en Polygon'
        : 'Wallet conectada — completa tu verificación de identidad para recibir el badge',
      ...result,
    })
  })
}

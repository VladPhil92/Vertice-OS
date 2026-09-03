import type { FastifyInstance } from 'fastify'
import { requireAuth, requireVerified } from '../../middleware/auth'
import {
  ConfirmCedulaSchema,
  ConfirmEmailTokenSchema,
  UpdateProfileSchema,
  ConnectWalletSchema,
  CivicProofingEventSchema,
} from './identity.schema'
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
import {
  getCivicIdentityProofs,
  ingestCivicProofingEvent,
} from './identity-proofing.service'

const WalletNonceSchema = z.object({
  wallet_address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Dirección de wallet inválida'),
})

const DID_CONTENT_TYPE = 'application/did+ld+json'

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

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

  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const doc = await getOwnDIDDocument(request.citizen.sub)
    reply.header('Content-Type', DID_CONTENT_TYPE)
    return reply.send(doc)
  })

  app.get('/status', { preHandler: requireAuth }, async (request, reply) => {
    const status = await getVerificationStatus(request.citizen.sub)
    return reply.send(status)
  })

  // GET /identity/assurance — frontera explícita entre login/contacto e
  // identidad cívica apta para acciones de gobernanza. Un ExternalIdentity/SSO
  // aislado nunca eleva este estado.
  app.get('/assurance', { preHandler: requireAuth }, async (request, reply) => {
    const assurance = await getCivicIdentityAssurance(request.citizen.sub)
    return reply.send(assurance)
  })

  app.get('/proofing', { preHandler: requireAuth }, async (request, reply) => {
    const proofs = await getCivicIdentityProofs(request.citizen.sub)
    return reply.send({
      proofs: proofs.map((proof) => ({
        id: proof.id,
        provider: proof.provider,
        status: proof.status,
        assurance_level: Number(proof.assurance_level),
        verified_at: proof.verified_at?.toISOString() ?? null,
        expires_at: proof.expires_at?.toISOString() ?? null,
        revoked_at: proof.revoked_at?.toISOString() ?? null,
        updated_at: proof.updated_at.toISOString(),
      })),
    })
  })

  // Server-to-server normalized adapter ingress. Each provider/key-id has its
  // own HMAC key, allowing independent rotation and preventing one adapter key
  // from authenticating events for another provider.
  // POST /identity/proofing/events — ingress server-to-server para eventos ya
  // normalizados por un adaptador que validó primero la firma nativa del KYC.
  // P0.4 autentica después ese salto interno con una llave aislada por provider
  // + key-id y un timestamp firmado de cinco minutos, evitando secreto global,
  // replay indefinido y activación de proveedores sin canal de revocación.
  app.post('/proofing/events', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = CivicProofingEventSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Evento de identity proofing inválido',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const rawSignature = request.headers['x-vertice-proofing-signature']
    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature
    const rawKeyId = request.headers['x-vertice-proofing-key-id']
    const keyId = Array.isArray(rawKeyId) ? rawKeyId[0] : rawKeyId
    const result = await ingestCivicProofingEvent(parsed.data, signature, keyId)
    const result = await ingestCivicProofingEvent(parsed.data, {
      signature: firstHeader(request.headers['x-vertice-proofing-signature']),
      timestamp: firstHeader(request.headers['x-vertice-proofing-timestamp']),
      key_id: firstHeader(request.headers['x-vertice-proofing-key-id']),
    })

    return reply.status(result.duplicate ? 200 : 202).send({
      accepted: true,
      duplicate: result.duplicate,
      proof: {
        id: result.proof.id,
        provider: result.proof.provider,
        status: result.proof.status,
        assurance_level: Number(result.proof.assurance_level),
        verified_at: result.proof.verified_at?.toISOString() ?? null,
        expires_at: result.proof.expires_at?.toISOString() ?? null,
        revoked_at: result.proof.revoked_at?.toISOString() ?? null,
      },
    })
  })

  // ── Verificación de cédula (nivel 0 → 1) ─────────────────────────────────

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

  app.post('/verify/email', {
    preHandler: requireVerified,
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    const result = await requestEmailVerification(request.citizen.sub)
    return reply.send(result)
  })

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

  app.put('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UpdateProfileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors })
    }

    await updateCitizenProfile(request.citizen.sub, parsed.data)
    return reply.send({ message: 'Perfil territorial actualizado' })
  })

  // ── Wallet Polygon ────────────────────────────────────────────────────────

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

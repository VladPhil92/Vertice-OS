import type { FastifyInstance } from 'fastify'
import { requireSuperadmin } from '../../middleware/auth'
import {
  getActivatedCivicIdentityProviders,
  getCivicIdentityProviderActivationState,
  getNativeCivicIdentityProviderAdapter,
  getRegisteredNativeCivicIdentityProviders,
  getRuntimeReadyNativeCivicIdentityProviders,
} from './identity-provider-registry'
import { ingestNativeCivicProofingEvent } from './identity-proofing.service'

const MAX_NATIVE_WEBHOOK_BYTES = 1024 * 1024

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  return 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

/**
 * Provider-native webhook ingress.
 *
 * This plugin deliberately installs a JSON content parser only inside its own
 * Fastify encapsulation scope. The request body therefore remains the exact
 * byte sequence received from the provider until the compiled native adapter
 * authenticates it. Normal API routes keep Fastify's normal JSON parser.
 */
export async function identityProviderWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser('application/json', {
    parseAs: 'buffer',
    bodyLimit: MAX_NATIVE_WEBHOOK_BYTES,
  }, (_request, body, done) => {
    done(null, body)
  })

  app.get('/readiness', { preHandler: requireSuperadmin }, async (_request, reply) => {
    const registeredNative = getRegisteredNativeCivicIdentityProviders()
    const runtimeReady = getRuntimeReadyNativeCivicIdentityProviders()
    const activated = getActivatedCivicIdentityProviders()

    return reply.send({
      state: getCivicIdentityProviderActivationState(),
      registered_native_providers: registeredNative,
      runtime_ready_native_providers: runtimeReady,
      activated_providers: activated,
      native_ingress_available: registeredNative.length > 0,
      credentialed_native_ingress_available: runtimeReady.length > 0,
      governance_assurance_enabled: activated.length > 0,
    })
  })

  app.post('/:provider/webhook', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { provider } = request.params as { provider: string }
    const adapter = getNativeCivicIdentityProviderAdapter(provider)
    if (!adapter) {
      return reply.status(503).send({
        error: 'El adaptador nativo de identity proofing no está disponible',
        code: 'NATIVE_PROVIDER_ADAPTER_UNAVAILABLE',
      })
    }

    if (!Buffer.isBuffer(request.body)) {
      return reply.status(400).send({
        error: 'Payload nativo de identity proofing inválido',
        code: 'INVALID_NATIVE_WEBHOOK_BODY',
      })
    }

    try {
      const delivery = await adapter.verifyAndNormalizeWithReceipt({
        raw_body: request.body,
        headers: request.headers,
        received_at: new Date(),
      })

      const result = await ingestNativeCivicProofingEvent(delivery.event, {
        signed_at: delivery.receipt.signed_at,
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
    } catch (error) {
      // A provider retry must never be processed twice. Acknowledge a verified
      // replay after the adapter has rejected it so vendors do not create an
      // infinite retry storm while the security boundary remains fail-closed.
      if (errorCode(error) === 'REPLAYED_NATIVE_WEBHOOK') {
        return reply.status(200).send({ accepted: true, duplicate: true })
      }
      throw error
    }
  })
}

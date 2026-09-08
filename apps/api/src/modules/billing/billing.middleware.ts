import type { FastifyReply, FastifyRequest } from 'fastify'
import { requireAuth } from '../../middleware/auth'
import { planHasEntitlement, type EntitlementKey } from './billing.catalog'
import { getEffectiveBillingAccess } from './billing.service'

export function requireEntitlement(entitlement: EntitlementKey) {
  return async function entitlementGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply)
    if (reply.sent) return

    const access = await getEffectiveBillingAccess(request.citizen.sub)
    if (planHasEntitlement(access.plan.code, entitlement)) return

    reply.status(403).send({
      error: 'Esta funcionalidad requiere un plan con mayor capacidad.',
      code: 'PLAN_UPGRADE_REQUIRED',
      entitlement,
      currentPlan: access.plan.code,
      upgradePath: '/pricing',
    })
  }
}

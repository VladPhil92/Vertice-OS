import { Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import {
  MercadoPagoBillingProvider,
  getMercadoPagoConfigurationState,
} from './mercadopago.provider'

const PROVIDER = 'mercadopago'
const provider = new MercadoPagoBillingProvider()

type RecurringBillingBinding = {
  source: 'subscription' | 'transaction'
  provider: string
  external_id: string | null
  status: string
}

function billingDeletionError(message: string, statusCode: number, code: string): Error {
  return Object.assign(new Error(message), { statusCode, code })
}

/**
 * Cancels external recurring mandates before an identity can be erased.
 *
 * This is intentionally separate from the DB erasure transaction: network I/O
 * must not hold database locks. The account-deletion transaction revalidates
 * the user/session afterwards, so a concurrent change cannot turn this provider
 * side effect into an unauthorized identity erasure.
 *
 * A provider cancellation that succeeds while a later DB step fails is safe:
 * the account remains usable, but it cannot be charged again. The inverse
 * state (identity erased while a mandate can still charge) is forbidden.
 */
export async function prepareRecurringBillingForAccountDeletion(citizenId: string): Promise<void> {
  const bindings = await prisma.$queryRaw<RecurringBillingBinding[]>(Prisma.sql`
    SELECT 'subscription'::text AS source,
           COALESCE(provider, '')::text AS provider,
           provider_subscription_id::text AS external_id,
           status::text AS status
    FROM subscriptions
    WHERE citizen_id = ${citizenId}::uuid
      AND status IN ('trialing', 'active', 'past_due')

    UNION ALL

    SELECT 'transaction'::text AS source,
           provider::text AS provider,
           provider_transaction_id::text AS external_id,
           status::text AS status
    FROM payment_transactions
    WHERE citizen_id = ${citizenId}::uuid
      AND kind = 'subscription'
      AND status IN ('pending', 'authorized')
  `)

  const unresolved = bindings.filter((binding) => {
    // A local pending row without a provider id means checkout creation never
    // established a known mandate; it can be cancelled locally during erasure.
    if (binding.source === 'transaction' && binding.status === 'pending' && !binding.external_id) {
      return false
    }
    return binding.provider !== PROVIDER || !binding.external_id
  })

  if (unresolved.length > 0) {
    throw billingDeletionError(
      'Existe una suscripción o mandato recurrente que debe conciliarse antes de eliminar la cuenta.',
      409,
      'ACCOUNT_DELETION_BILLING_RECONCILIATION_REQUIRED',
    )
  }

  const mandateIds = Array.from(new Set(
    bindings
      .map((binding) => binding.external_id)
      .filter((value): value is string => Boolean(value)),
  ))

  if (mandateIds.length === 0) return

  if (getMercadoPagoConfigurationState() !== 'ready') {
    throw billingDeletionError(
      'No es posible confirmar la cancelación del cobro recurrente en este momento.',
      503,
      'ACCOUNT_DELETION_BILLING_PROVIDER_UNAVAILABLE',
    )
  }

  for (const externalId of mandateIds) {
    try {
      await provider.cancelSubscription(externalId)
    } catch {
      throw billingDeletionError(
        'El proveedor no confirmó la cancelación del cobro recurrente. La cuenta permanece activa para evitar un cobro huérfano.',
        503,
        'ACCOUNT_DELETION_BILLING_CANCELLATION_FAILED',
      )
    }
  }
}

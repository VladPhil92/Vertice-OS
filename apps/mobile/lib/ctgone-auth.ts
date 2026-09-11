import * as Linking from 'expo-linking'

import { exchangeMobileCtgOne, startMobileCtgOne } from './api'
import {
  clearPendingCtgOneFederation,
  getPendingCtgOneFederation,
  setPendingCtgOneFederation,
} from './session'

const EXPECTED_CALLBACK = 'vertice://auth/ctgone/callback'

export async function beginCtgOneFederation(): Promise<void> {
  const transaction = await startMobileCtgOne()

  if (transaction.callback_uri !== EXPECTED_CALLBACK) {
    throw new Error('La API devolvió un callback móvil no reconocido.')
  }

  await setPendingCtgOneFederation({
    transactionId: transaction.transaction_id,
    state: transaction.state,
    expiresAt: Date.now() + transaction.expires_in * 1000,
  })

  const supported = await Linking.canOpenURL(transaction.authorize_url)
  if (!supported) {
    await clearPendingCtgOneFederation()
    throw new Error('No fue posible abrir el acceso seguro de CTG One.')
  }

  await Linking.openURL(transaction.authorize_url)
}

export async function completeCtgOneFederation(code: string, returnedState: string): Promise<void> {
  const pending = await getPendingCtgOneFederation()
  if (!pending) {
    throw new Error('No existe una autenticación CTG One pendiente en este dispositivo.')
  }

  if (pending.expiresAt <= Date.now()) {
    await clearPendingCtgOneFederation()
    throw new Error('La autenticación CTG One expiró. Iníciala nuevamente.')
  }

  if (!returnedState || returnedState !== pending.state) {
    await clearPendingCtgOneFederation()
    throw new Error('La respuesta de CTG One no coincide con la sesión iniciada en este dispositivo.')
  }

  try {
    await exchangeMobileCtgOne({
      code,
      state: returnedState,
      transaction_id: pending.transactionId,
    })
  } finally {
    // The server transaction is one-time even when the exchange fails. Removing
    // the local transaction prevents unsafe retries with stale authorization codes.
    await clearPendingCtgOneFederation()
  }
}

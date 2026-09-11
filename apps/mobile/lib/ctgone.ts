import * as Linking from 'expo-linking'

import { apiFetch } from './api'
import {
  clearPendingCtgOneFederation,
  getPendingCtgOneFederation,
  setPendingCtgOneFederation,
  setSessionTokens,
} from './session'
import type { MobileTokenResponse } from '../types/api'

interface MobileCtgOneStartResponse {
  authorize_url: string
  transaction_id: string
  state: string
  callback_uri: string
  expires_in: number
}

function mobileFederationError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code })
}

export async function beginCtgOneMobileSignIn(): Promise<void> {
  const start = await apiFetch<MobileCtgOneStartResponse>('/auth/mobile/ctgone/start', {
    method: 'POST',
    public: true,
  })

  if (!start.authorize_url.startsWith('https://')) {
    throw mobileFederationError(
      'VÉRTICE recibió una URL de autorización CTG One no segura.',
      'INVALID_CTG_ONE_AUTHORIZE_URL',
    )
  }

  await setPendingCtgOneFederation({
    transactionId: start.transaction_id,
    state: start.state,
    expiresAt: Date.now() + start.expires_in * 1000,
  })

  try {
    await Linking.openURL(start.authorize_url)
  } catch (error) {
    await clearPendingCtgOneFederation()
    throw error
  }
}

export async function completeCtgOneMobileSignIn(code: string, state: string): Promise<MobileTokenResponse> {
  const pending = await getPendingCtgOneFederation()
  if (!pending) {
    throw mobileFederationError(
      'La sesión de acceso con CTG One no existe o ya finalizó. Iníciala de nuevo desde VÉRTICE.',
      'MOBILE_FEDERATION_TRANSACTION_MISSING',
    )
  }

  if (Date.now() > pending.expiresAt) {
    await clearPendingCtgOneFederation()
    throw mobileFederationError(
      'La autorización con CTG One expiró. Inicia el acceso nuevamente.',
      'MOBILE_FEDERATION_TRANSACTION_EXPIRED',
    )
  }

  if (pending.state !== state) {
    await clearPendingCtgOneFederation()
    throw mobileFederationError(
      'La respuesta de CTG One no coincide con la sesión segura iniciada en esta aplicación.',
      'MOBILE_FEDERATION_STATE_MISMATCH',
    )
  }

  try {
    const token = await apiFetch<MobileTokenResponse>('/auth/mobile/ctgone/exchange', {
      method: 'POST',
      public: true,
      body: JSON.stringify({
        code,
        state,
        transaction_id: pending.transactionId,
      }),
    })

    await setSessionTokens(token.access_token, token.refresh_token)
    return token
  } finally {
    // The backend transaction is single-use. Never keep a stale handoff that
    // could make the next attempt appear to continue the previous session.
    await clearPendingCtgOneFederation()
  }
}

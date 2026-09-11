import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'vertice.access_token'
const REFRESH_TOKEN_KEY = 'vertice.refresh_token'
const CTG_ONE_PENDING_KEY = 'vertice.ctgone.pending'

export interface PendingCtgOneFederation {
  transactionId: string
  state: string
  expiresAt: number
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

export async function setSessionTokens(accessToken: string, refreshToken?: string): Promise<void> {
  const writes: Array<Promise<void>> = [
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
  ]

  if (refreshToken) {
    writes.push(SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken))
  }

  await Promise.all(writes)
}

export async function setPendingCtgOneFederation(value: PendingCtgOneFederation): Promise<void> {
  await SecureStore.setItemAsync(CTG_ONE_PENDING_KEY, JSON.stringify(value))
}

export async function getPendingCtgOneFederation(): Promise<PendingCtgOneFederation | null> {
  const raw = await SecureStore.getItemAsync(CTG_ONE_PENDING_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PendingCtgOneFederation>
    if (
      typeof parsed.transactionId !== 'string'
      || typeof parsed.state !== 'string'
      || typeof parsed.expiresAt !== 'number'
    ) {
      await clearPendingCtgOneFederation()
      return null
    }
    return {
      transactionId: parsed.transactionId,
      state: parsed.state,
      expiresAt: parsed.expiresAt,
    }
  } catch {
    await clearPendingCtgOneFederation()
    return null
  }
}

export async function clearPendingCtgOneFederation(): Promise<void> {
  await SecureStore.deleteItemAsync(CTG_ONE_PENDING_KEY)
}

export async function clearSessionTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}

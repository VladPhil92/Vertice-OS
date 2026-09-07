import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'vertice.access_token'
const REFRESH_TOKEN_KEY = 'vertice.refresh_token'

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

export async function clearSessionTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ])
}

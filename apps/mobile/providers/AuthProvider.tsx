import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, loginMobile, logoutMobile } from '../lib/api'
import { clearSessionTokens, getRefreshToken } from '../lib/session'
import { deactivatePushRegistration } from '../lib/push-notifications'
import type { CitizenProfile } from '../types/api'

interface AuthContextValue {
  user: CitizenProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CitizenProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    const profile = await apiFetch<CitizenProfile>('/auth/me')
    setUser(profile)
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      try {
        const refreshToken = await getRefreshToken()
        if (!refreshToken) return
        const profile = await apiFetch<CitizenProfile>('/auth/me')
        if (active) setUser(profile)
      } catch {
        await clearSessionTokens()
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    await loginMobile(email, password)
    const profile = await apiFetch<CitizenProfile>('/auth/me')
    setUser(profile)
  }, [])

  const signOut = useCallback(async () => {
    // Deactivate the current citizen/token association while auth is still
    // valid. Failure never prevents logout, and the local opt-in preference is
    // preserved so a future sign-in can re-register without another prompt.
    try {
      await deactivatePushRegistration({ preservePreference: true })
    } catch {
      // best effort: auth revocation remains authoritative
    }
    await logoutMobile()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn,
    signOut,
    refreshProfile,
  }), [user, loading, signIn, signOut, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch, loginMobile, logoutMobile } from '../lib/api'
import { beginCtgOneMobileSignIn, completeCtgOneMobileSignIn } from '../lib/ctgone'
import { registerAndLoginMobile } from '../lib/registration'
import { clearSessionTokens, getRefreshToken } from '../lib/session'
import { deactivatePushRegistration } from '../lib/push-notifications'
import type { CitizenProfile } from '../types/api'

export interface AccountDeletionReceipt {
  request_id: string
  status: 'completed'
  completed_at: string
  retention_policy_version: string
  retained_categories: string[]
  auxiliary_cleanup_queued: boolean
}

interface AuthContextValue {
  user: CitizenProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithCtgOne: () => Promise<void>
  completeCtgOneSignIn: (code: string, state: string) => Promise<void>
  signUp: (email: string, password: string, cedula: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<AccountDeletionReceipt>
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

  const signInWithCtgOne = useCallback(async () => {
    await beginCtgOneMobileSignIn()
  }, [])

  const completeCtgOneSignIn = useCallback(async (code: string, state: string) => {
    await completeCtgOneMobileSignIn(code, state)
    const profile = await apiFetch<CitizenProfile>('/auth/me')
    setUser(profile)
  }, [])

  const signUp = useCallback(async (email: string, password: string, cedula: string) => {
    await registerAndLoginMobile({ email, password, cedula })
    const profile = await apiFetch<CitizenProfile>('/auth/me')
    setUser(profile)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await deactivatePushRegistration({ preservePreference: true })
    } catch {
      // best effort: auth revocation remains authoritative
    }
    await logoutMobile()
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    // Remove the device subscription first while the authenticated session is
    // still live. The server-side erasure repeats this deletion authoritatively.
    try {
      await deactivatePushRegistration()
    } catch {
      // Account erasure must not depend on Expo availability.
    }

    try {
      const receipt = await apiFetch<AccountDeletionReceipt>('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'ELIMINAR', source: 'mobile' }),
      })
      await clearSessionTokens()
      setUser(null)
      return receipt
    } catch (error) {
      throw error
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn,
    signInWithCtgOne,
    completeCtgOneSignIn,
    signUp,
    signOut,
    deleteAccount,
    refreshProfile,
  }), [
    user,
    loading,
    signIn,
    signInWithCtgOne,
    completeCtgOneSignIn,
    signUp,
    signOut,
    deleteAccount,
    refreshProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

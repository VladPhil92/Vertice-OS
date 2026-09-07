'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, DASHBOARD_IDENTITY_CHANGED_EVENT } from '@/lib/api'

export type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'

export interface DashboardCivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: boolean
  reputation_score: number
}

export interface DashboardCivicAvatarState {
  citizen_id: string
  avatar_url: string | null
  status: 'missing' | 'approved' | 'rejected'
  updated_at?: string | null
  upload_enabled?: boolean
}

export interface DashboardIdentitySnapshot {
  profile: {
    id: string
    email: string
    neighborhood: string | null
    verification_level: number
  }
}

interface DashboardIdentityContextValue {
  profile: DashboardCivicProfile | null
  avatar: DashboardCivicAvatarState | null
  dashboardIdentity: DashboardIdentitySnapshot | null
  displayName: string
  territory: string
  identityVerified: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DashboardIdentityContext = createContext<DashboardIdentityContextValue | null>(null)

export function DashboardIdentityProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DashboardCivicProfile | null>(null)
  const [avatar, setAvatar] = useState<DashboardCivicAvatarState | null>(null)
  const [dashboardIdentity, setDashboardIdentity] = useState<DashboardIdentitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const hasLoaded = useRef(false)

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current
    if (!hasLoaded.current) setLoading(true)
    setError(null)

    try {
      const [profileData, avatarData, dashboardData] = await Promise.all([
        apiFetch<DashboardCivicProfile>('/community/profile/me'),
        apiFetch<DashboardCivicAvatarState>('/community/profile/me/avatar'),
        apiFetch<DashboardIdentitySnapshot>('/dashboard/me'),
      ])

      if (requestSequence.current !== requestId) return
      setProfile(profileData)
      setAvatar(avatarData)
      setDashboardIdentity(dashboardData)
      hasLoaded.current = true
    } catch (refreshError) {
      if (requestSequence.current !== requestId) return
      setError(refreshError instanceof Error ? refreshError.message : 'No fue posible cargar la identidad del dashboard.')
    } finally {
      if (requestSequence.current === requestId) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => {
      requestSequence.current += 1
    }
  }, [refresh])

  useEffect(() => {
    const handleIdentityChanged = () => {
      void refresh()
    }
    window.addEventListener(DASHBOARD_IDENTITY_CHANGED_EVENT, handleIdentityChanged)
    return () => window.removeEventListener(DASHBOARD_IDENTITY_CHANGED_EVENT, handleIdentityChanged)
  }, [refresh])

  const displayName = useMemo(() => {
    if (profile?.display_name?.trim()) return profile.display_name.trim()
    const email = dashboardIdentity?.profile.email
    if (email) return email.split('@')[0] ?? 'Mi perfil cívico'
    return 'Mi perfil cívico'
  }, [dashboardIdentity?.profile.email, profile?.display_name])

  const territory = profile?.neighborhood
    ?? dashboardIdentity?.profile.neighborhood
    ?? 'Cartagena de Indias'
  const identityVerified = (dashboardIdentity?.profile.verification_level ?? 0) >= 1

  const value = useMemo<DashboardIdentityContextValue>(() => ({
    profile,
    avatar,
    dashboardIdentity,
    displayName,
    territory,
    identityVerified,
    loading,
    error,
    refresh,
  }), [
    avatar,
    dashboardIdentity,
    displayName,
    error,
    identityVerified,
    loading,
    profile,
    refresh,
    territory,
  ])

  return (
    <DashboardIdentityContext.Provider value={value}>
      {children}
    </DashboardIdentityContext.Provider>
  )
}

export function useDashboardIdentity(): DashboardIdentityContextValue {
  const context = useContext(DashboardIdentityContext)
  if (!context) {
    throw new Error('useDashboardIdentity debe usarse dentro de DashboardIdentityProvider')
  }
  return context
}

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
import {
  apiFetch,
  DASHBOARD_RUNTIME_INVALIDATED_EVENT,
  type DashboardRuntimeInvalidationDetail,
  type DashboardRuntimeScope,
} from '@/lib/api'

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

export interface DashboardRuntimeSnapshot {
  profile: {
    id: string
    email: string
    neighborhood: string | null
    verification_level: number
  }
  reputation: {
    score: number
    level: string
    total_votes: number
    total_proposals: number
    total_reports: number
    badges_count: number
    endorsements_given: number
  }
  attention: {
    pending_votes: Array<{ id: string; title: string; voting_ends_at: string | null }>
    legal_needs_action: number
    reports_in_progress: number
    civic_actions_needing_evidence: number
    total_items: number
  }
  mine: {
    civic_actions: {
      total: number
      active: number
      verified: number
      needs_evidence: number
      awaiting_verification: number
      recent: Array<{
        id: string
        title: string
        category: string
        neighborhood: string | null
        status: string
        civic_score: number
        confidence_score: number
        evidence_count: number
        updated_at: string
      }>
    }
    reports: {
      total: number
      recent: Array<{
        id: string
        title: string
        status: string
        neighborhood: string | null
        updated_at: string
      }>
    }
    proposals: {
      total: number
      recent: Array<{
        id: string
        title: string
        status: string
        endorsement_count: number
        total_votes: number
        created_at: string
      }>
    }
    workflows: {
      total: number
      active: number
    }
  }
  city: {
    reports: {
      total_reports: number
      by_category: Array<{ resolved_count: number }>
    }
    governance: {
      by_status: Array<{ status: string; count: number }>
    }
  }
  generated_at: string
}

export type DashboardIdentitySnapshot = DashboardRuntimeSnapshot

export interface DashboardResolutionItem {
  id: string
  title: string
  status: string
  updated_at: string
  evidence_count: number
  next_step: 'reopen_execution' | 'attach_evidence' | 'declare_result'
  next_step_label: string
  detail: string
  follow_up_label: string
  priority: 'urgent' | 'high' | 'normal'
  href: string
}

export interface DashboardResolutionPlan {
  total: number
  items: DashboardResolutionItem[]
}

interface DashboardIdentityContextValue {
  profile: DashboardCivicProfile | null
  avatar: DashboardCivicAvatarState | null
  dashboardIdentity: DashboardIdentitySnapshot | null
  dashboard: DashboardRuntimeSnapshot | null
  resolutionPlan: DashboardResolutionPlan | null
  resolutionError: string | null
  displayName: string
  territory: string
  identityVerified: boolean
  loading: boolean
  refreshing: boolean
  error: string | null
  refresh: (scope?: DashboardRuntimeScope) => Promise<void>
}

const DashboardIdentityContext = createContext<DashboardIdentityContextValue | null>(null)

export function DashboardIdentityProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DashboardCivicProfile | null>(null)
  const [avatar, setAvatar] = useState<DashboardCivicAvatarState | null>(null)
  const [dashboard, setDashboard] = useState<DashboardRuntimeSnapshot | null>(null)
  const [resolutionPlan, setResolutionPlan] = useState<DashboardResolutionPlan | null>(null)
  const [resolutionError, setResolutionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const hasLoaded = useRef(false)

  const refresh = useCallback(async (scope: DashboardRuntimeScope = 'all') => {
    const requestId = ++requestSequence.current
    if (!hasLoaded.current) setLoading(true)
    else setRefreshing(true)

    if (scope === 'all' || scope === 'identity' || scope === 'dashboard') setError(null)
    if (scope === 'all' || scope === 'resolution') setResolutionError(null)

    const wantsIdentity = scope === 'all' || scope === 'identity'
    const wantsDashboard = scope === 'all' || scope === 'dashboard' || scope === 'identity'
    const wantsResolution = scope === 'all' || scope === 'resolution'

    try {
      const tasks: Promise<void>[] = []

      if (wantsIdentity) {
        tasks.push((async () => {
          const [profileData, avatarData] = await Promise.all([
            apiFetch<DashboardCivicProfile>('/community/profile/me'),
            apiFetch<DashboardCivicAvatarState>('/community/profile/me/avatar'),
          ])
          if (requestSequence.current !== requestId) return
          setProfile(profileData)
          setAvatar(avatarData)
        })())
      }

      if (wantsDashboard) {
        tasks.push((async () => {
          const dashboardData = await apiFetch<DashboardRuntimeSnapshot>('/dashboard/me')
          if (requestSequence.current !== requestId) return
          setDashboard(dashboardData)
        })())
      }

      if (wantsResolution) {
        tasks.push((async () => {
          try {
            const plan = await apiFetch<DashboardResolutionPlan>('/dashboard/me/resolution')
            if (requestSequence.current !== requestId) return
            setResolutionPlan(plan)
          } catch (cause) {
            if (requestSequence.current !== requestId) return
            setResolutionError(cause instanceof Error ? cause.message : 'No fue posible cargar el plan de resolución.')
          }
        })())
      }

      await Promise.all(tasks)
      if (requestSequence.current !== requestId) return
      hasLoaded.current = true
    } catch (refreshError) {
      if (requestSequence.current !== requestId) return
      setError(refreshError instanceof Error ? refreshError.message : 'No fue posible cargar el runtime del dashboard.')
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void refresh('all')
    return () => {
      requestSequence.current += 1
    }
  }, [refresh])

  useEffect(() => {
    const handleRuntimeInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<DashboardRuntimeInvalidationDetail>).detail
      void refresh(detail?.scope ?? 'all')
    }
    window.addEventListener(DASHBOARD_RUNTIME_INVALIDATED_EVENT, handleRuntimeInvalidated)
    return () => window.removeEventListener(DASHBOARD_RUNTIME_INVALIDATED_EVENT, handleRuntimeInvalidated)
  }, [refresh])

  const displayName = useMemo(() => {
    if (profile?.display_name?.trim()) return profile.display_name.trim()
    const email = dashboard?.profile.email
    if (email) return email.split('@')[0] ?? 'Mi perfil cívico'
    return 'Mi perfil cívico'
  }, [dashboard?.profile.email, profile?.display_name])

  const territory = profile?.neighborhood
    ?? dashboard?.profile.neighborhood
    ?? 'Cartagena de Indias'
  const identityVerified = (dashboard?.profile.verification_level ?? 0) >= 1

  const value = useMemo<DashboardIdentityContextValue>(() => ({
    profile,
    avatar,
    dashboardIdentity: dashboard,
    dashboard,
    resolutionPlan,
    resolutionError,
    displayName,
    territory,
    identityVerified,
    loading,
    refreshing,
    error,
    refresh,
  }), [
    avatar,
    dashboard,
    displayName,
    error,
    identityVerified,
    loading,
    profile,
    refresh,
    refreshing,
    resolutionError,
    resolutionPlan,
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

/**
 * Phase 4 semantic alias. Existing identity consumers remain source-compatible,
 * while new dashboard surfaces can consume the complete shared runtime.
 */
export const useDashboardRuntime = useDashboardIdentity

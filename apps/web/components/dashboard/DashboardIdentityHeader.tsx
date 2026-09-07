'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Eye, EyeOff, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { CivicAvatar } from '@/components/community/CivicAvatar'
import { apiFetch } from '@/lib/api'

type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'

interface CivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: boolean
  reputation_score: number
}

interface CivicAvatarState {
  citizen_id: string
  avatar_url: string | null
  status: 'missing' | 'approved' | 'rejected'
}

interface DashboardIdentitySnapshot {
  profile: {
    id: string
    email: string
    neighborhood: string | null
    verification_level: number
  }
}

const PROFILE_TYPE_LABEL: Record<CivicProfileType, string> = {
  citizen: 'Ciudadanía',
  social_leader: 'Liderazgo social',
  candidate: 'Candidatura',
  organization_rep: 'Organización',
  public_official: 'Gestión pública',
}

export default function DashboardIdentityHeader() {
  const [profile, setProfile] = useState<CivicProfile | null>(null)
  const [avatar, setAvatar] = useState<CivicAvatarState | null>(null)
  const [dashboardIdentity, setDashboardIdentity] = useState<DashboardIdentitySnapshot | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      apiFetch<CivicProfile>('/community/profile/me'),
      apiFetch<CivicAvatarState>('/community/profile/me/avatar'),
      apiFetch<DashboardIdentitySnapshot>('/dashboard/me'),
    ])
      .then(([profileData, avatarData, dashboardData]) => {
        if (!active) return
        setProfile(profileData)
        setAvatar(avatarData)
        setDashboardIdentity(dashboardData)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [])

  const displayName = useMemo(() => {
    if (profile?.display_name?.trim()) return profile.display_name.trim()
    const email = dashboardIdentity?.profile.email
    if (email) return email.split('@')[0] ?? 'Mi perfil cívico'
    return 'Mi perfil cívico'
  }, [dashboardIdentity?.profile.email, profile?.display_name])

  if (failed) return null

  if (!profile || !avatar || !dashboardIdentity) {
    return (
      <div className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8" aria-label="Cargando identidad cívica">
        <div className="mx-auto h-[118px] max-w-7xl animate-pulse rounded-[24px] border border-[#E1E7EF] bg-white" />
      </div>
    )
  }

  const identityVerified = dashboardIdentity.profile.verification_level >= 1
  const territory = profile.neighborhood ?? dashboardIdentity.profile.neighborhood ?? 'Cartagena de Indias'

  return (
    <section
      className="bg-[#F7F9FC] px-4 pt-5 sm:px-6 lg:px-8"
      aria-labelledby="dashboard-identity-title"
      data-testid="dashboard-identity-header"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[24px] border border-[#DCE4EE] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <CivicAvatar
            src={avatar.status === 'approved' ? avatar.avatar_url : null}
            name={displayName}
            identityVerified={identityVerified}
            size="lg"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="dashboard-identity-title" className="truncate font-display text-xl font-extrabold text-[#0A2A66] sm:text-2xl">
                {displayName}
              </h1>
              <span className="rounded-full border border-[#C8D8EE] bg-[#EDF3FA] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#245EA7]">
                {PROFILE_TYPE_LABEL[profile.profile_type]}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-[#607087]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-[#7E8CA2]" />
                {territory}
              </span>
              {profile.organization && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#7E8CA2]" />
                  {profile.organization}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                {profile.public_profile ? <Eye size={13} /> : <EyeOff size={13} />}
                {profile.public_profile ? 'Perfil público' : 'Perfil privado'}
              </span>
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#607087]">
              {identityVerified ? (
                <>
                  <ShieldCheck size={13} className="text-[#2BA745]" />
                  Identidad verificada
                </>
              ) : (
                <>
                  <UserRound size={13} className="text-[#D98B00]" />
                  Verificación de identidad pendiente
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          <Link
            href="/dashboard/community/profile"
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0A2A66] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.07em] text-white"
          >
            Editar perfil cívico
            <ArrowRight size={13} />
          </Link>
          {!identityVerified && (
            <Link
              href="/dashboard/identity"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E1E7EF] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.07em] text-[#0A2A66]"
            >
              Verificar identidad
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  BadgeCheck,
  Building2,
  FileText,
  Loader2,
  MapPin,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'
type ActivityType = 'report' | 'proposal'

type CivicActivity = {
  id: string
  type: ActivityType
  title: string
  summary: string
  status: string
  civic_score: number
  evidence_count: number
  verification_state: 'declared' | 'evidence_backed' | 'verified'
  community_validation: { corroborations: number; disputes: number; total: number }
  updated_at: string
  href: string
}

interface PublicCivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: true
  reputation_score: number
  follower_count: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
  recent_actions: CivicActivity[]
}

interface FollowState {
  following: boolean
  follower_count: number
}

const PROFILE_LABEL: Record<CivicProfileType, string> = {
  citizen: 'Ciudadanía',
  social_leader: 'Liderazgo social',
  candidate: 'Candidatura',
  organization_rep: 'Organización',
  public_official: 'Gestión pública',
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export default function PublicCivicProfilePage() {
  const params = useParams<{ citizenId: string }>()
  const citizenId = params.citizenId
  const [profile, setProfile] = useState<PublicCivicProfile | null>(null)
  const [followState, setFollowState] = useState<FollowState | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      apiFetch<PublicCivicProfile>(`/community/profiles/${citizenId}`, { public: true }),
      apiFetch<FollowState>(`/community/profiles/${citizenId}/follow-state`).catch(() => null),
    ])
      .then(([profileData, state]) => {
        setProfile(profileData)
        setFollowState(state)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No fue posible cargar el perfil.'))
      .finally(() => setLoading(false))
  }, [citizenId])

  async function toggleFollow() {
    if (!followState) return
    setWorking(true)
    try {
      const next = await apiFetch<FollowState>(`/community/profiles/${citizenId}/follow`, {
        method: followState.following ? 'DELETE' : 'POST',
      })
      setFollowState(next)
      setProfile((current) => current ? { ...current, follower_count: next.follower_count } : current)
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#4A90E2]" /></div>
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-[#F1C8CE] bg-[#FCEBED] p-6 text-sm font-semibold text-[#A91D2E]">
          {error ?? 'Este perfil no está disponible públicamente.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(10,42,102,.07)]">
        <div className="h-1.5 bg-[linear-gradient(90deg,#F5B700_0_33%,#4A90E2_33%_66%,#D72638_66%)]" />
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EDF3FA] px-3 py-1 text-[9px] font-extrabold uppercase tracking-[.1em] text-[#246CB6]">
                  {PROFILE_LABEL[profile.profile_type]}
                </span>
                {profile.organization && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#607087]"><Building2 size={12} /> {profile.organization}</span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold tracking-[-.03em] text-[#0A2A66] sm:text-4xl">
                {profile.display_name ?? 'Perfil cívico VÉRTICE'}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-[#7B8799]">
                {profile.neighborhood && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {profile.neighborhood}</span>}
                <span className="inline-flex items-center gap-1"><Users size={12} /> {profile.follower_count} seguidores</span>
              </div>
              {profile.bio && <p className="mt-5 max-w-3xl text-sm font-medium leading-7 text-[#526176]">{profile.bio}</p>}
            </div>

            {followState && (
              <button
                onClick={toggleFollow}
                disabled={working}
                className={followState.following
                  ? 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C9D8EA] bg-[#EDF3FA] px-5 text-xs font-extrabold text-[#0A2A66] disabled:opacity-60'
                  : 'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0A2A66] px-5 text-xs font-extrabold text-white disabled:opacity-60'}
              >
                {working ? <Loader2 size={15} className="animate-spin" /> : followState.following ? <UserCheck size={15} /> : <UserPlus size={15} />}
                {followState.following ? 'Siguiendo' : 'Seguir gestión'}
              </button>
            )}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Acciones', profile.actions_count],
              ['Verificadas', profile.verified_actions],
              ['Evidencias', profile.evidence_count],
              ['Score medio', profile.average_action_score],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-[#F7F9FC] p-4">
                <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">{label}</div>
                <div className="mt-2 text-2xl font-extrabold text-[#0A2A66]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7B8799]">Trayectoria documentada</div>
            <h2 className="mt-1 text-xl font-extrabold text-[#0A2A66]">Gestión reciente</h2>
          </div>
          <Link href="/dashboard/community" className="text-xs font-extrabold text-[#246CB6]">Volver a la red</Link>
        </div>

        <div className="space-y-3">
          {profile.recent_actions.length === 0 && (
            <div className="rounded-3xl border border-[#E1E7EF] bg-white p-7 text-sm font-medium text-[#607087]">Este perfil aún no tiene gestión visible en la red.</div>
          )}
          {profile.recent_actions.map((activity) => (
            <article key={`${activity.type}-${activity.id}`} className="rounded-[22px] border border-[#E1E7EF] bg-white p-4 shadow-[0_8px_30px_rgba(10,42,102,.04)] sm:p-5">
              <div className="flex gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#7B8799]">
                    <span>{activity.type === 'report' ? 'Gestión' : 'Iniciativa'}</span>
                    <span>·</span><span>{formatDate(activity.updated_at)}</span>
                  </div>
                  <Link href={activity.href} className="mt-2 block text-base font-extrabold leading-6 text-[#0A2A66] hover:text-[#246CB6]">{activity.title}</Link>
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-[#607087]">{activity.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-extrabold">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4D1] px-2.5 py-1 text-[#8A6500]"><ShieldCheck size={11} /> {activity.evidence_count} evidencias</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6ED] px-2.5 py-1 text-[#237D36]"><BadgeCheck size={11} /> {activity.community_validation.corroborations} corroboraciones</span>
                    {activity.community_validation.disputes > 0 && <span className="rounded-full bg-[#FCEBED] px-2.5 py-1 text-[#A91D2E]">{activity.community_validation.disputes} disputas</span>}
                  </div>
                </div>
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EDF3FA]">
                  <span className="text-lg font-extrabold text-[#0A2A66]">{activity.civic_score}</span>
                  <span className="text-[7px] font-extrabold uppercase text-[#7B8799]">score</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-4 text-[10px] font-semibold leading-5 text-[#607087]">
        <div className="flex items-start gap-2"><FileText size={14} className="mt-0.5 shrink-0 text-[#246CB6]" /> Los seguidores sirven para descubrir y suscribirse a gestión. No aumentan el VÉRTICE Score ni el ranking.</div>
      </section>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Building2, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react'
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

const PROFILE_TYPES: Array<{ value: CivicProfileType; label: string; description: string }> = [
  { value: 'citizen', label: 'Ciudadanía', description: 'Participación y gestión desde la comunidad.' },
  { value: 'social_leader', label: 'Liderazgo social', description: 'Trabajo comunitario, territorial o colectivo.' },
  { value: 'candidate', label: 'Candidatura', description: 'Persona aspirante a un cargo de elección popular.' },
  { value: 'organization_rep', label: 'Organización', description: 'Representación de una organización o colectivo.' },
  { value: 'public_official', label: 'Gestión pública', description: 'Servidor o representante de una entidad pública.' },
]

export default function CivicProfilePage() {
  const [profile, setProfile] = useState<CivicProfile | null>(null)
  const [profileType, setProfileType] = useState<CivicProfileType>('citizen')
  const [bio, setBio] = useState('')
  const [organization, setOrganization] = useState('')
  const [publicProfile, setPublicProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<CivicProfile>('/community/profile/me')
      .then((data) => {
        setProfile(data)
        setProfileType(data.profile_type)
        setBio(data.bio ?? '')
        setOrganization(data.organization ?? '')
        setPublicProfile(data.public_profile)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await apiFetch<CivicProfile>('/community/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          profile_type: profileType,
          bio: bio.trim() || null,
          organization: organization.trim() || null,
          public_profile: publicProfile,
        }),
      })
      setProfile(updated)
      setMessage('Perfil cívico actualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#4A90E2]" /></div>
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-5 shadow-[0_16px_45px_rgba(10,42,102,.06)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Identidad social pública</div>
            <h1 className="mt-2 text-2xl font-extrabold text-[#0A2A66] sm:text-3xl">Configura cómo apareces en la red cívica.</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-[#607087]">
              Tu tipo de perfil cívico describe tu actividad pública, pero no modifica tus permisos de seguridad dentro de VÉRTICE.
            </p>
          </div>
          <div className="rounded-2xl bg-[#EDF3FA] px-4 py-3 text-right">
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Reputación actual</div>
            <div className="mt-1 text-2xl font-extrabold text-[#0A2A66]">{Math.round(profile?.reputation_score ?? 0)}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {PROFILE_TYPES.map((option) => {
            const selected = option.value === profileType
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setProfileType(option.value)}
                className={selected
                  ? 'rounded-2xl border border-[#4A90E2] bg-[#EDF3FA] p-4 text-left shadow-sm'
                  : 'rounded-2xl border border-[#E1E7EF] bg-white p-4 text-left hover:bg-[#F7F9FC]'}
              >
                <div className="flex items-center gap-2">
                  {option.value === 'organization_rep' ? <Building2 size={16} /> : option.value === 'candidate' ? <BadgeCheck size={16} /> : <UserRound size={16} />}
                  <span className="text-xs font-extrabold text-[#0A2A66]">{option.label}</span>
                </div>
                <p className="mt-2 text-[10px] font-medium leading-5 text-[#607087]">{option.description}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid gap-5">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#607087]">Biografía de gestión</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={600}
              rows={5}
              placeholder="Describe tu trabajo comunitario, territorio, experiencia y áreas de acción."
              className="mt-2 w-full rounded-2xl border border-[#DCE5EF] bg-[#FBFCFE] px-4 py-3 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]"
            />
            <div className="mt-1 text-right text-[9px] font-semibold text-[#94A0B0]">{bio.length}/600</div>
          </label>

          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#607087]">Organización o colectivo</span>
            <input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              maxLength={180}
              placeholder="Opcional"
              className="mt-2 h-12 w-full rounded-2xl border border-[#DCE5EF] bg-[#FBFCFE] px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]"
            />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={publicProfile}
              onChange={(event) => setPublicProfile(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]"><ShieldCheck size={15} /> Publicar mi perfil cívico</div>
              <p className="mt-1 text-[10px] font-medium leading-5 text-[#607087]">
                Al activarlo, tu nombre, tipo de perfil, organización, territorio y métricas de gestión podrán aparecer en el feed y rankings. Si lo desactivas, tus acciones públicas siguen visibles pero tu identidad se presenta de forma anónima y no participas en rankings personales.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EDF3] pt-5">
          <div className="text-xs font-semibold text-[#607087]">{message ?? (publicProfile ? 'Tu perfil será visible cuando guardes.' : 'Tu identidad permanece anónima en la red pública.')}</div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0A2A66] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar perfil
          </button>
        </div>
      </section>
    </div>
  )
}

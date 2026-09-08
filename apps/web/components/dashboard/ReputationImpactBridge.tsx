'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, BadgeCheck, Eye, FileCheck2, ShieldCheck, Target } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type AuthProfile = { id: string }
type ReputationProfile = { reputation_score: number; total_votes: number; total_proposals: number; total_reports: number }
type CivicProfile = {
  public_profile: boolean
  follower_count: number
  actions_count: number
  verified_actions: number
  evidence_count: number
  average_action_score: number
}

export function ReputationImpactBridge() {
  const [reputation, setReputation] = useState<ReputationProfile | null>(null)
  const [impact, setImpact] = useState<CivicProfile | null>(null)
  const [privateProfile, setPrivateProfile] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      apiFetch<AuthProfile>('/auth/me'),
      apiFetch<ReputationProfile>('/reputation/me'),
    ]).then(async ([auth, rep]) => {
      if (!active) return
      setReputation(rep)
      try {
        const civic = await apiFetch<CivicProfile>(`/community/profiles/${auth.id}`, { public: true })
        if (active) setImpact(civic)
      } catch {
        if (active) setPrivateProfile(true)
      }
    }).catch(() => null)
    return () => { active = false }
  }, [])

  if (!reputation) return null

  return (
    <section data-testid="reputation-impact-bridge" className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-0">
      <div className="rounded-[24px] border border-[#D9E4F1] bg-white p-5 shadow-[0_12px_35px_rgba(10,42,102,.05)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#246CB6]"><Target size={13} /> Modelo convergente</div>
            <h2 className="mt-2 text-xl font-extrabold text-[#0A2A66]">Impacto comprobable ≠ actividad acumulada</h2>
            <p className="mt-2 max-w-2xl text-xs font-medium leading-6 text-[#607087]">VÉRTICE conserva el puntaje histórico de participación para compatibilidad, pero la lectura pública de liderazgo prioriza evidencia, resultados verificados, transparencia, colaboración, continuidad y confianza.</p>
            <div className="mt-4 rounded-2xl bg-[#F7F9FC] p-4">
              <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">Participación histórica</span><span className="text-xl font-extrabold text-[#0A2A66]">{reputation.reputation_score}</span></div>
              <div className="mt-2 text-[10px] font-semibold text-[#607087]">{reputation.total_reports} reportes · {reputation.total_proposals} propuestas · {reputation.total_votes} participaciones en votación</div>
            </div>
          </div>

          {impact ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={Activity} label="Score medio de gestión" value={`${impact.average_action_score}/100`} />
              <Metric icon={BadgeCheck} label="Resultados verificados" value={`${impact.verified_actions}/${impact.actions_count}`} />
              <Metric icon={FileCheck2} label="Evidencias" value={String(impact.evidence_count)} />
              <Metric icon={Eye} label="Seguidores" value={String(impact.follower_count)} muted />
              <div className="col-span-2 rounded-xl border border-[#D7E5DA] bg-[#F2F8F3] p-3 text-[10px] font-semibold leading-5 text-[#46624C]"><ShieldCheck size={13} className="mr-1 inline" />Los seguidores se muestran como contexto social, pero no suman al score de impacto.</div>
            </div>
          ) : privateProfile ? (
            <div className="flex flex-col justify-center rounded-2xl border border-dashed border-[#C9D6E5] bg-[#F7F9FC] p-5">
              <div className="text-sm font-extrabold text-[#0A2A66]">Publica tu perfil para activar la lectura de impacto</div>
              <p className="mt-2 text-xs font-medium leading-5 text-[#607087]">La analítica de gestión pública solo se expone cuando decides publicar tu perfil cívico.</p>
              <Link href="/dashboard/community/profile" className="mt-4 text-xs font-extrabold text-[#246CB6]">Configurar perfil público →</Link>
            </div>
          ) : <div className="rounded-2xl bg-[#F7F9FC]" />}
        </div>
      </div>
    </section>
  )
}

function Metric({ icon: Icon, label, value, muted = false }: { icon: typeof Activity; label: string; value: string; muted?: boolean }) {
  return <div className="rounded-2xl border border-[#E1E7EF] bg-[#F9FBFD] p-4"><div className="flex items-center justify-between"><span className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[#7B8799]">{label}</span><Icon size={14} className={muted ? 'text-[#9AA5B4]' : 'text-[#4A90E2]'} /></div><div className="mt-2 text-lg font-extrabold text-[#0A2A66]">{value}</div></div>
}

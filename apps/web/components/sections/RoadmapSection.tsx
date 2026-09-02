import Link from 'next/link'
import { ArrowRight, Landmark, Network, ShieldCheck } from 'lucide-react'

const VISION_POINTS = [
  { icon: Landmark, label: 'Piloto territorial', text: 'Cartagena de Indias' },
  { icon: Network, label: 'Aprendizaje', text: 'Validar antes de escalar' },
  { icon: ShieldCheck, label: 'Escala responsable', text: 'Trazabilidad y seguridad' },
] as const

export function RoadmapSection() {
  return (
    <section id="vision" className="bg-white px-5 pb-20 pt-8 sm:px-6 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-4 rounded-[24px] bg-[#0A2A66] p-6 text-white shadow-[0_22px_60px_rgba(10,42,102,.17)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
          <div className="flex gap-5">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#F5B700]/35 bg-[#F5B700]/10 text-[#F5B700] sm:flex">
              <Landmark size={27} strokeWidth={1.7} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Visión</span>
              <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">
                La ciudadanía es el <span className="text-[#F5B700]">vértice</span> del cambio.
              </h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/72">
                Consolidamos primero una experiencia útil en Cartagena, medimos cómo funciona y escalamos sólo lo que demuestre valor ciudadano y sostenibilidad técnica.
              </p>
            </div>
          </div>

          <Link href="/auth/register" className="btn-citizen group gap-2 whitespace-nowrap lg:min-w-[210px]">
            Explorar la plataforma
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {VISION_POINTS.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E1E7EF] bg-[#FBFCFE] px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF2F8] text-[#0A2A66]">
                <Icon size={17} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.09em] text-[#7B8799]">{label}</div>
                <div className="mt-1 text-xs font-extrabold text-[#0A2A66]">{text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

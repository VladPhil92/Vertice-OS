import Link from 'next/link'
import { ArrowRight, Landmark, Network, ShieldCheck } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const PHASES = [
  {
    eyebrow: 'AHORA',
    title: 'Base operativa',
    text: 'Consolidar identidad, reportes, propuestas, gobernanza, IA y seguimiento dentro de una experiencia estable.',
    icon: Landmark,
    color: '#246CB6',
    bg: '#EAF1FB',
  },
  {
    eyebrow: 'SIGUIENTE',
    title: 'Piloto y aprendizaje',
    text: 'Validar flujos con ciudadanía real, medir fricción y documentar qué funcionalidades generan valor comprobable.',
    icon: Network,
    color: '#D98B00',
    bg: '#FFF4D1',
  },
  {
    eyebrow: 'DESPUÉS',
    title: 'Escala responsable',
    text: 'Extender únicamente capacidades validadas, manteniendo trazabilidad, seguridad e identidad territorial.',
    icon: ShieldCheck,
    color: '#D72638',
    bg: '#FCEBED',
  },
] as const

export function RoadmapSection() {
  return (
    <section id="vision" className="bg-white px-5 pb-20 pt-20 sm:px-6 md:pb-24 md:pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:items-end">
          <PublicSectionHeader
            eyebrow="Visión"
            title="Crecer desde evidencia, no desde promesas."
            description="VÉRTICE parte de Cartagena como piloto territorial. La expansión depende del aprendizaje obtenido, la utilidad comprobada y la capacidad técnica para conservar seguridad y trazabilidad."
          />

          <div className="grid gap-3 sm:grid-cols-3">
            {PHASES.map(({ eyebrow, title, text, icon: Icon, color, bg }) => (
              <article key={eyebrow} className="rounded-[22px] border border-[#E1E7EF] bg-[#FBFCFE] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color, background: bg }}>
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div className="mt-4 text-[9px] font-extrabold uppercase tracking-[.13em]" style={{ color }}>{eyebrow}</div>
                <h3 className="mt-2 text-sm font-extrabold text-[#0A2A66]">{title}</h3>
                <p className="mt-2 text-[10px] font-medium leading-5 text-[#607087]">{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[28px] bg-[#0A2A66] p-6 text-white shadow-[0_22px_60px_rgba(10,42,102,.17)] sm:p-8 lg:px-10 lg:py-9">
          <div className="absolute inset-x-0 top-0 grid h-1.5 grid-cols-3">
            <span className="bg-[#F5B700]" />
            <span className="bg-[#4A90E2]" />
            <span className="bg-[#D72638]" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex gap-5">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#F5B700]/35 bg-[#F5B700]/10 text-[#F5B700] sm:flex">
                <Landmark size={27} strokeWidth={1.7} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#F5B700]">Participación</span>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">
                  La ciudadanía es el <span className="text-[#F5B700]">vértice</span> del cambio.
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70">
                  Explora la plataforma, conoce sus herramientas y participa dentro de los flujos disponibles del piloto.
                </p>
              </div>
            </div>

            <Link href="/auth/register" className="btn-citizen group gap-2 whitespace-nowrap lg:min-w-[210px]">
              Explorar la plataforma
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

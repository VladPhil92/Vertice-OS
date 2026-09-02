import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MapPin, ShieldCheck, Siren, TrendingUp } from 'lucide-react'

const HERO_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Identidad cívica y trazabilidad',
    text: 'Participa desde una cuenta con historial visible.',
    color: '#246CB6',
  },
  {
    icon: Siren,
    title: 'Señal ciudadana',
    text: 'Reporta lo que pasa en un territorio concreto.',
    color: '#D98B00',
  },
  {
    icon: TrendingUp,
    title: 'Seguimiento',
    text: 'Consulta el estado y la evolución de los asuntos.',
    color: '#2BA745',
  },
] as const

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white px-5 pb-16 pt-28 sm:px-6 md:pb-20 md:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_84%_18%,rgba(74,144,226,.12),transparent_30%),radial-gradient(circle_at_12%_18%,rgba(245,183,0,.09),transparent_28%)]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-[0.94fr_1.06fr] xl:gap-14">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#0A2A66]">
              <span>Inteligencia ciudadana</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5B700]" />
              <span>Piloto Cartagena de Indias</span>
            </div>

            <h1 className="font-display text-[3rem] font-extrabold leading-[1.02] tracking-[-0.05em] text-[#0A2A66] sm:text-6xl lg:text-[4.5rem]">
              Cartagena
              <br />
              la construimos{' '}
              <span className="font-serif font-light italic tracking-[-0.02em] text-[#F5B700]">juntos.</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] font-medium leading-7 text-[#4B5870] sm:text-[17px] sm:leading-8">
              VÉRTICE conecta ciudadanía, información y seguimiento público para convertir señales del territorio
              en participación, deliberación y acción colectiva.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/auth/register" className="btn-primary group gap-2">
                Tu voz tiene poder
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#como-funciona" className="btn-ghost gap-2">
                Conoce cómo funciona
              </a>
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              {HERO_FEATURES.map(({ icon: Icon, title, text, color }) => (
                <div key={title} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F7F9FC]" style={{ color }}>
                    <Icon size={17} strokeWidth={1.9} />
                  </div>
                  <div>
                    <div className="text-[11px] font-extrabold leading-4 text-[#0A2A66]">{title}</div>
                    <p className="mt-1 text-[10px] font-medium leading-4 text-[#6D7890]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[720px]">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-[#4A90E2]/8 blur-3xl" />
            <div className="overflow-hidden rounded-[28px] border border-[#DCE5EF] bg-[#EAF3FB] shadow-[0_28px_70px_rgba(10,42,102,.14)]">
              <div className="relative aspect-[1.22/1] sm:aspect-[1.34/1] lg:aspect-[1.2/1]">
                <Image
                  src="/brand/cartagena-civic-panorama.svg"
                  alt="Ilustración de Cartagena conectada por una red de participación ciudadana"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  className="object-cover"
                />

                <div className="absolute left-4 top-4 max-w-[190px] rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:left-6 sm:top-6">
                  <div className="flex items-center gap-2 text-[#246CB6]">
                    <MapPin size={15} />
                    <span className="text-[9px] font-extrabold uppercase tracking-[.1em]">Reporte ciudadano</span>
                  </div>
                  <div className="mt-2 text-[11px] font-extrabold text-[#0A2A66]">Alumbrado público · El Laguito</div>
                </div>

                <div className="absolute right-4 top-5 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:right-6 sm:top-7">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Caso en seguimiento</div>
                  <div className="mt-1.5 text-sm font-extrabold text-[#0A2A66]">En revisión</div>
                  <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-[#E4EAF1]">
                    <div className="h-full w-[68%] rounded-full bg-[#4A90E2]" />
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:bottom-6 sm:left-6">
                  <div className="text-[9px] font-extrabold uppercase tracking-[.1em] text-[#7B8799]">Acción en curso</div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] font-extrabold text-[#0A2A66]">
                    <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                    Seguimiento abierto
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

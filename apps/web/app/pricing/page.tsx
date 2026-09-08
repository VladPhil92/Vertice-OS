import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Planes | VÉRTICE',
  description: 'VÉRTICE Free y VÉRTICE Pro: participa gratis o amplía tus herramientas de gestión cívica por $15.000 COP al mes.',
}

const FREE_FEATURES = [
  'Perfil y red cívica',
  'Publicaciones y participación comunitaria',
  'Registro de acciones con evidencia',
  'Reputación y ranking cívico completos',
  'Hasta 3 proyectos activos',
  'Participar y aportar a causas',
  'IA cívica con cuota básica',
]

const PRO_FEATURES = [
  'Todo lo incluido en Free',
  'Hasta 50 proyectos activos',
  'Analítica avanzada de gestión e impacto',
  'Reportes y exportaciones',
  'Mayor capacidad de IA cívica',
  'Programación y automatización de publicaciones',
  'Analítica avanzada para campañas de crowdfunding',
  '5 GB de almacenamiento de evidencias',
]

function PriceCard({
  name,
  eyebrow,
  price,
  annual,
  description,
  features,
  featured = false,
}: {
  name: string
  eyebrow: string
  price: string
  annual: string
  description: string
  features: readonly string[]
  featured?: boolean
}) {
  return (
    <article className={`relative flex h-full flex-col rounded-[28px] border p-7 sm:p-8 ${featured ? 'border-[#0A2A66] bg-[#0A2A66] text-white shadow-[0_24px_70px_rgba(10,42,102,.18)]' : 'border-[#DCE5EF] bg-white text-[#0A2A66] shadow-[0_18px_55px_rgba(10,42,102,.07)]'}`}>
      {featured && (
        <div className="absolute -top-3 right-6 rounded-full bg-[#F5B700] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#0A2A66]">
          Recomendado
        </div>
      )}
      <div className={`text-[10px] font-black uppercase tracking-[.15em] ${featured ? 'text-[#BFD0E8]' : 'text-[#718096]'}`}>{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-[-.03em]">{name}</h2>
      <p className={`mt-3 min-h-12 text-sm leading-6 ${featured ? 'text-white/70' : 'text-[#607087]'}`}>{description}</p>

      <div className="mt-7 flex items-end gap-2">
        <span className="text-4xl font-black tracking-[-.04em]">{price}</span>
        <span className={`pb-1 text-xs font-bold ${featured ? 'text-white/60' : 'text-[#7B8799]'}`}>COP / mes</span>
      </div>
      <div className={`mt-1 text-xs font-semibold ${featured ? 'text-[#BFD0E8]' : 'text-[#7B8799]'}`}>{annual}</div>

      <ul className="mt-8 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm font-semibold leading-5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${featured ? 'bg-white/12 text-[#F5B700]' : 'bg-[#EAF1FB] text-[#0A2A66]'}`}>
              <Check size={12} strokeWidth={3} />
            </span>
            <span className={featured ? 'text-white/86' : 'text-[#43506A]'}>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={featured ? '/auth/register?plan=pro' : '/auth/register'}
        className={`mt-8 flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black uppercase tracking-[.08em] transition ${featured ? 'bg-[#F5B700] text-[#0A2A66] hover:bg-[#FFD54F]' : 'bg-[#0A2A66] text-white hover:bg-[#143A78]'}`}
      >
        {featured ? 'Elegir Pro' : 'Comenzar gratis'}
        <ArrowRight size={15} />
      </Link>
    </article>
  )
}

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#F7F9FC] pt-28 text-[#0A2A66]">
        <section className="mx-auto max-w-7xl px-5 pb-20 pt-10 sm:px-6 lg:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF1FB] text-[#0A2A66]">
              <Sparkles size={22} />
            </div>
            <div className="mt-5 text-[11px] font-black uppercase tracking-[.16em] text-[#607087]">Planes VÉRTICE</div>
            <h1 className="mt-4 text-4xl font-black tracking-[-.045em] sm:text-5xl lg:text-6xl">
              Participar es gratis. Gestionar a escala puede ser Pro.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-7 text-[#607087]">
              El plan nunca compra influencia. Free y Pro usan el mismo sistema de reputación, verificación y ranking cívico.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
            <PriceCard
              name="VÉRTICE Free"
              eyebrow="Participación"
              price="$0"
              annual="Gratis para siempre"
              description="La capa esencial para participar, organizarte, registrar acciones y construir reputación basada en evidencia."
              features={FREE_FEATURES}
            />
            <PriceCard
              name="VÉRTICE Pro"
              eyebrow="Gestión avanzada"
              price="$15.000"
              annual="$150.000 COP al año — dos meses incluidos"
              description="Más capacidad operativa, analítica y automatización para personas que gestionan múltiples iniciativas."
              features={PRO_FEATURES}
              featured
            />
          </div>

          <div className="mx-auto mt-8 max-w-5xl rounded-[24px] border border-[#DCE5EF] bg-white p-6 shadow-[0_14px_45px_rgba(10,42,102,.05)] sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5EC] text-[#238A3B]">
                <ShieldCheck size={22} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-black">El dinero no compra reputación en VÉRTICE</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-[#607087]">
                  Suscribirse, donar, recaudar más dinero o patrocinar una iniciativa no otorga puntos de reputación, mayor peso de voto ni prioridad algorítmica. La reputación depende de gestión, evidencia, cumplimiento e impacto verificable.
                </p>
              </div>
              <Link href="/dashboard/billing" className="shrink-0 text-xs font-black text-[#0A2A66] underline decoration-[#F5B700] decoration-2 underline-offset-4">
                Ver mi plan
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

import Link from 'next/link'
import { ArrowRight, BadgeDollarSign, HandCoins, Landmark, ShieldCheck } from 'lucide-react'

export function CrowdfundingDashboardShortcut() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-10 sm:px-8 lg:px-10">
      <div className="overflow-hidden rounded-[28px] border border-[#D9E4F1] bg-white shadow-[0_18px_50px_rgba(10,42,102,.06)]">
        <div className="grid lg:grid-cols-[1.05fr_.95fr]">
          <div className="bg-[#0A2A66] p-7 text-white sm:p-8">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#BFD0E8]">
              <HandCoins size={15} className="text-[#F5B700]" />
              Financiación de impacto
            </div>
            <h2 className="mt-3 max-w-xl text-2xl font-black tracking-[-.035em] sm:text-3xl">
              Convierte una causa comunitaria en una campaña financiable y verificable.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70">
              Crea campañas, elige una política de financiación, sigue el recaudo y prepara el desembolso sin mezclar dinero con reputación cívica.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/crowdfunding"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F5B700] px-5 text-xs font-black text-[#0A2A66] transition hover:brightness-95"
              >
                Abrir financiación
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard/crowdfunding/new"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-xs font-black text-white transition hover:bg-white/15"
              >
                Crear campaña
              </Link>
            </div>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-3 lg:grid-cols-1 lg:p-7">
            <Feature
              icon={BadgeDollarSign}
              title="Política transparente"
              text="Flexible, todo o nada o por hitos según el modelo de la campaña."
            />
            <Feature
              icon={Landmark}
              title="Desembolso BRE-B"
              text="Destino resuelto y confirmado por el propio beneficiario antes de mover fondos."
            />
            <Feature
              icon={ShieldCheck}
              title="Reputación neutral"
              text="Recaudar o aportar dinero nunca concede puntos de reputación ni ventaja cívica."
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof HandCoins
  title: string
  text: string
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[#F7F9FC] p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]">
        <Icon size={18} />
      </span>
      <div>
        <div className="text-xs font-black text-[#0A2A66]">{title}</div>
        <p className="mt-1 text-[11px] font-medium leading-5 text-[#607087]">{text}</p>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { Gauge, ArrowRight } from 'lucide-react'

export function OperationalCapacityShortcut() {
  return (
    <section className="mx-auto mt-5 max-w-7xl px-5 sm:px-8" data-testid="operational-capacity-shortcut">
      <Link
        href="/dashboard/operations"
        prefetch={false}
        className="group flex items-center gap-4 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-[0_12px_32px_rgba(10,42,102,.04)] transition hover:border-[#BFD0E8] hover:bg-[#FBFCFE]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FB] text-[#0A2A66]">
          <Gauge size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[.13em] text-[#7B8799]">Capacidad operativa</div>
          <div className="mt-1 text-sm font-black text-[#0A2A66]">Uso del plan, exportaciones y automatizaciones</div>
          <p className="mt-1 text-xs font-medium text-[#607087]">Controla tus límites reales sin mezclar consumo del plan con reputación cívica.</p>
        </div>
        <ArrowRight size={17} className="shrink-0 text-[#7B8799] transition group-hover:translate-x-0.5 group-hover:text-[#0A2A66]" />
      </Link>
    </section>
  )
}

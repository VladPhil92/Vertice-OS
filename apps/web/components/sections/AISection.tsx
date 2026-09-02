import { FileText, MapPin, MessageSquareText, Scale, Sparkles } from 'lucide-react'

const USE_CASES = [
  { icon: MessageSquareText, label: 'Explicar', color: '#178C8C', bg: '#E7F6F5' },
  { icon: FileText, label: 'Estructurar', color: '#246CB6', bg: '#EAF1FB' },
  { icon: MapPin, label: 'Contextualizar', color: '#0A2A66', bg: '#EDF2F8' },
  { icon: Scale, label: 'Sintetizar', color: '#D72638', bg: '#FCEBED' },
] as const

export function AISection() {
  return (
    <section id="ia" className="bg-white px-5 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[26px] border border-[#E1E7EF] bg-[linear-gradient(135deg,#F8FBFF,#FFFFFF_55%,#FFF8E2)] shadow-[0_18px_55px_rgba(10,42,102,.07)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:p-10">
            <div>
              <span className="section-tag">IA cívica</span>
              <h2 className="max-w-2xl font-display text-3xl font-extrabold tracking-[-0.04em] text-[#0A2A66] md:text-4xl">
                IA para comprender mejor,
                <span className="text-[#D72638]"> no para decidir por ti.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-[#607087]">
                La IA de VÉRTICE organiza y explica información para apoyar la deliberación. Las decisiones,
                propuestas y votos siguen siendo responsabilidad de las personas.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {USE_CASES.map(({ icon: Icon, label, color, bg }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E1E7EF] bg-white px-4 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color, background: bg }}>
                      <Icon size={17} strokeWidth={1.8} />
                    </div>
                    <span className="text-[11px] font-extrabold text-[#0A2A66]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] bg-[#0A2A66] p-5 text-white shadow-[0_18px_50px_rgba(10,42,102,.18)] sm:p-6">
              <div className="flex items-center gap-3 border-b border-white/15 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#F5B700]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-xs font-extrabold">Asistente cívico</div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-white/55">Contexto antes que respuesta</div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white/9 p-4 text-xs leading-6 text-white/85">
                “Puedo ayudarte a organizar una propuesta, resumir información disponible y señalar qué datos faltan antes de participar.”
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#EAF6ED] px-3 py-2 text-[10px] font-extrabold text-[#237D36]">
                <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                La decisión sigue siendo humana
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { FileText, MapPin, MessageSquareText, Scale, Sparkles } from 'lucide-react'
import { PublicSectionHeader } from '@/components/ui/PublicSectionHeader'

const USE_CASES = [
  { icon: MessageSquareText, label: 'Explicar', detail: 'Traduce conceptos y procesos complejos.', color: '#178C8C', bg: '#E7F6F5' },
  { icon: FileText, label: 'Estructurar', detail: 'Ordena ideas, argumentos y propuestas.', color: '#246CB6', bg: '#EAF1FB' },
  { icon: MapPin, label: 'Contextualizar', detail: 'Relaciona asuntos con territorio y evidencia.', color: '#0A2A66', bg: '#EDF2F8' },
  { icon: Scale, label: 'Sintetizar', detail: 'Resume información antes de deliberar.', color: '#D72638', bg: '#FCEBED' },
] as const

export function AISection() {
  return (
    <section id="ia" className="bg-white px-5 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[30px] bg-[#0A2A66] text-white shadow-[0_28px_70px_rgba(10,42,102,.18)]">
          <div className="grid h-1.5 grid-cols-3">
            <span className="bg-[#F5B700]" />
            <span className="bg-[#4A90E2]" />
            <span className="bg-[#D72638]" />
          </div>

          <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:p-12">
            <div>
              <PublicSectionHeader
                eyebrow="IA cívica"
                title="IA para comprender mejor, no para decidir por ti."
                description="La IA de VÉRTICE organiza y explica información para apoyar la deliberación. Las decisiones, propuestas y votos siguen siendo responsabilidad de las personas."
                inverse
              />

              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[.11em] text-white/85">
                <span className="h-2 w-2 rounded-full bg-[#F5B700]" />
                Contexto antes que respuesta
              </div>
            </div>

            <div className="relative rounded-[26px] border border-white/15 bg-white p-5 text-[#0A2A66] shadow-[0_24px_60px_rgba(0,0,0,.16)] sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-[#E9EDF3] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4D1] text-[#D98B00]">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">Asistente cívico</div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#7B8799]">Apoyo deliberativo</div>
                  </div>
                </div>
                <div className="hidden rounded-full bg-[#EAF6ED] px-3 py-2 text-[9px] font-extrabold text-[#237D36] sm:block">
                  Decisión humana
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-4 text-xs font-medium leading-6 text-[#526176]">
                “Puedo ayudarte a organizar una propuesta, resumir información disponible y señalar qué datos faltan antes de participar.”
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {USE_CASES.map(({ icon: Icon, label, detail, color, bg }) => (
                  <div key={label} className="rounded-2xl border border-[#E1E7EF] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ color, background: bg }}>
                        <Icon size={17} strokeWidth={1.8} />
                      </div>
                      <span className="text-[11px] font-extrabold text-[#0A2A66]">{label}</span>
                    </div>
                    <p className="mt-3 text-[10px] font-medium leading-5 text-[#607087]">{detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#CBE9D1] bg-[#EAF6ED] px-4 py-3 text-[10px] font-extrabold text-[#237D36]">
                <span className="h-2 w-2 rounded-full bg-[#2BA745]" />
                La decisión sigue siendo humana.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

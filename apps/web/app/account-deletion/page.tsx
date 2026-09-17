import Link from 'next/link'
import { AlertTriangle, Clock, Database, ShieldCheck, Trash2 } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'Eliminar cuenta | VÉRTICE OS',
  description: 'Información y acceso al proceso de eliminación de cuenta de VÉRTICE OS.',
}

const DELETED_DATA = [
  'Correo, credenciales y hash de documento.',
  'Sesiones, dispositivos push e identidades federadas.',
  'Proofing de identidad y referencias del proveedor.',
  'Perfil público, avatar, seguidores y publicaciones sociales.',
] as const

export default function AccountDeletionPublicPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white pt-[78px]">
        <section className="overflow-hidden bg-[#0A2A66] text-white">
          <div className="grid h-1.5 grid-cols-3">
            <span className="bg-[#F5B700]" />
            <span className="bg-[#4A90E2]" />
            <span className="bg-[#D72638]" />
          </div>
          <div className="mx-auto max-w-4xl px-5 py-16 sm:px-6">
            <BrandLogo variant="symbol" compact className="mb-6 opacity-90" />
            <div className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#F5B700]">Privacidad y datos</div>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Eliminar tu cuenta de VÉRTICE</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
              Puedes iniciar la eliminación de tu cuenta directamente desde la aplicación móvil o desde tu sesión web. No necesitas contactar soporte para solicitarla.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-5 py-14 sm:px-6">
          <section className="rounded-3xl border border-[#DDE5EF] bg-[#FAFBFD] p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0A2A66] shadow-sm"><Trash2 size={19} /></span>
              <h2 className="text-xl font-extrabold text-[#0A2A66]">Cómo solicitar la eliminación</h2>
            </div>
            <ol className="mt-6 space-y-3 text-sm leading-6 text-[#43506A]">
              <li className="flex gap-3"><span className="font-extrabold text-[#0A2A66]">1.</span> Inicia sesión con la cuenta que deseas eliminar.</li>
              <li className="flex gap-3"><span className="font-extrabold text-[#0A2A66]">2.</span> En web abre <strong className="text-[#0A2A66]">Privacidad y datos</strong>. En la app móvil abre <strong className="text-[#0A2A66]">Perfil → Privacidad y datos → Eliminar mi cuenta</strong>.</li>
              <li className="flex gap-3"><span className="font-extrabold text-[#0A2A66]">3.</span> Revisa el alcance de la eliminación, escribe <strong className="text-[#0A2A66]">ELIMINAR</strong> y confirma la operación irreversible.</li>
            </ol>

            <Link
              href="/auth/login?next=/dashboard/privacy"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0A2A66] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#123B7D]"
            >
              Iniciar sesión y solicitar eliminación
            </Link>
          </section>

          <section className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border border-[#DDE5EF] bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF4FC] text-[#246CB6]"><Database size={19} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">Datos que se eliminan</h2>
              <ul className="mt-4 space-y-2">
                {DELETED_DATA.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[#526174]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4A90E2]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-[#E5DDD5] bg-[#FFFDF9] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FCEBED] text-[#A91D2E]"><Clock size={19} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-[#6E3B32]">Retención limitada</h2>
              <p className="mt-4 text-sm leading-6 text-[#665B53]">
                Algunos registros cívicos, financieros o de seguridad pueden conservarse únicamente cuando sean necesarios para integridad histórica, obligaciones contables, prevención de fraude o resolución de disputas. Esos registros se mantienen sin el perfil público ni los identificadores directos de la cuenta.
              </p>
            </div>
          </section>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#F1C8CE] bg-[#FCEBED] p-5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#A91D2E]" />
            <p className="text-xs leading-6 text-[#7A2531]">
              La eliminación de cuenta es irreversible. Si una cuenta administrativa mantiene delegaciones activas, VÉRTICE exige transferir o revocar primero esa autoridad para no dejar permisos huérfanos. La autoridad raíz del sistema está excluida del autoservicio por continuidad y seguridad operacional.
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#7B8799]" />
            <p className="text-xs leading-6 text-[#7B8799]">
              Consulta también nuestra <Link href="/privacy-policy" className="font-bold text-[#0A2A66] underline underline-offset-4">política de privacidad completa</Link>.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

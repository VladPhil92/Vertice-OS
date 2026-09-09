import Link from 'next/link'

export const metadata = {
  title: 'Eliminar cuenta | VÉRTICE OS',
  description: 'Información y acceso al proceso de eliminación de cuenta de VÉRTICE OS.',
}

export default function AccountDeletionPublicPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-5 py-14 text-[#102340]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-xs font-extrabold uppercase tracking-[.18em] text-[#607087]">Privacidad y datos</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#0A2A66]">Eliminar tu cuenta de VÉRTICE</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#526174]">
            Puedes iniciar la eliminación de tu cuenta directamente desde la aplicación móvil o desde tu sesión web. No necesitas contactar soporte para solicitarla.
          </p>
        </div>

        <section className="rounded-3xl border border-[#DDE5EF] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#0A2A66]">Cómo solicitar la eliminación</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[#526174]">
            <li><strong>1.</strong> Inicia sesión con la cuenta que deseas eliminar.</li>
            <li><strong>2.</strong> En web abre <strong>Privacidad y datos</strong>. En la app móvil abre <strong>Perfil → Privacidad y datos → Eliminar mi cuenta</strong>.</li>
            <li><strong>3.</strong> Revisa el alcance de la eliminación, escribe <strong>ELIMINAR</strong> y confirma la operación irreversible.</li>
          </ol>

          <Link
            href="/auth/login?next=/dashboard/privacy"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#0A2A66] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#123B7D]"
          >
            Iniciar sesión y solicitar eliminación
          </Link>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-[#DDE5EF] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#0A2A66]">Datos que se eliminan</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[#526174]">
              <li>• correo, credenciales y hash de documento;</li>
              <li>• sesiones, dispositivos push e identidades federadas;</li>
              <li>• proofing de identidad y referencias del proveedor;</li>
              <li>• perfil público, avatar, seguidores y publicaciones sociales.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[#E5DDD5] bg-[#FFFDF9] p-6">
            <h2 className="text-lg font-extrabold text-[#6E3B32]">Retención limitada</h2>
            <p className="mt-4 text-sm leading-6 text-[#665B53]">
              Algunos registros cívicos, financieros o de seguridad pueden conservarse únicamente cuando sean necesarios para integridad histórica, obligaciones contables, prevención de fraude o resolución de disputas. Esos registros se mantienen sin el perfil público ni los identificadores directos de la cuenta.
            </p>
          </div>
        </section>

        <p className="mt-7 text-xs leading-5 text-[#7B8799]">
          La eliminación de cuenta es irreversible. Si una cuenta administrativa mantiene delegaciones activas, VÉRTICE exige transferir o revocar primero esa autoridad para no dejar permisos huérfanos. La autoridad raíz del sistema está excluida del autoservicio por continuidad y seguridad operacional.
        </p>
      </div>
    </main>
  )
}

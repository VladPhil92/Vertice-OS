import Link from 'next/link'

export const metadata = {
  title: 'Normas de Comunidad | VÉRTICE OS',
  description: 'Normas de seguridad, convivencia y moderación para contenido generado por usuarios en VÉRTICE OS.',
}

const POLICY_VERSION = '2026-09-09.1'

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] px-5 py-14 text-[#102340]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="text-xs font-extrabold uppercase tracking-[.18em] text-[#607087]">Trust & Safety · Versión {POLICY_VERSION}</div>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#0A2A66]">Normas de Comunidad de VÉRTICE</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#526174]">
            VÉRTICE es una red cívica orientada a gestión, evidencia y participación comunitaria. Estas normas aplican a perfiles, reportes territoriales, propuestas, publicaciones, imágenes y demás contenido generado por usuarios.
          </p>
        </div>

        <section className="rounded-3xl border border-[#DDE5EF] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#0A2A66]">Contenido y conductas no permitidas</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#526174]">
            <li>• acoso, hostigamiento, amenazas creíbles o incitación a la violencia;</li>
            <li>• ataques de odio o deshumanización dirigidos contra personas o grupos;</li>
            <li>• contenido sexual explotador o promoción de material sexual prohibido;</li>
            <li>• spam, automatización abusiva, enlaces maliciosos o manipulación coordinada;</li>
            <li>• suplantación engañosa de personas, organizaciones o autoridades;</li>
            <li>• publicación de datos personales sensibles de terceros sin justificación ni autorización;</li>
            <li>• evidencia deliberadamente falsificada o contenido destinado a engañar sobre una gestión cívica.</li>
          </ul>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-[#DDE5EF] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#0A2A66]">Reportar y bloquear</h2>
            <p className="mt-3 text-sm leading-6 text-[#526174]">
              Los usuarios autenticados pueden reportar perfiles o contenido desde las superficies de Comunidad y bloquear otros perfiles. Un bloqueo corta la relación social entre ambas cuentas y evita que el contenido del perfil bloqueado aparezca en el feed personalizado del usuario.
            </p>
          </div>

          <div className="rounded-3xl border border-[#E5DDD5] bg-[#FFFDF9] p-6">
            <h2 className="text-lg font-extrabold text-[#6E3B32]">Moderación</h2>
            <p className="mt-3 text-sm leading-6 text-[#665B53]">
              Las denuncias ingresan a una cola de moderación. VÉRTICE puede ocultar contenido o perfiles de las superficies públicas cuando exista una razón de seguridad o incumplimiento. La acción queda registrada para trazabilidad y no concede ni resta automáticamente reputación, voto o autoridad cívica.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#C9D8EA] bg-[#EDF3FA] p-6">
          <h2 className="text-lg font-extrabold text-[#0A2A66]">Aceptación y cambios de versión</h2>
          <p className="mt-3 text-sm leading-6 text-[#526174]">
            Antes de publicar o modificar contenido sujeto a estas normas, VÉRTICE solicita aceptación explícita de la versión vigente. Cuando la política cambie materialmente, la aplicación podrá requerir una nueva aceptación antes de permitir nuevas publicaciones.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0A2A66] px-5 text-sm font-extrabold text-white">
            Volver a VÉRTICE
          </Link>
          <Link href="/account-deletion" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#C9D8EA] bg-white px-5 text-sm font-extrabold text-[#0A2A66]">
            Privacidad y eliminación de cuenta
          </Link>
        </div>

        <p className="mt-8 text-xs leading-5 text-[#7B8799]">
          Estas normas regulan la convivencia y seguridad de la plataforma. No sustituyen los términos legales, políticas de privacidad ni obligaciones aplicables a cada servicio o transacción.
        </p>
      </div>
    </main>
  )
}

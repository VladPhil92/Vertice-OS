import Link from 'next/link'

export function EcosystemBridge() {
  return (
    <section className="mx-auto mt-5 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="CTG One Ecosystem">
      <div className="flex flex-col gap-4 rounded-3xl border border-[#DCE4EE] bg-white p-5 shadow-[0_16px_45px_rgba(10,42,102,.06)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7B8799]">CTG One Ecosystem</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#0A2A66]">VÉRTICE está conectado, no aislado.</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#607087]">
            Abre tu dashboard CTG One con una sesión propia. Si tu cuenta nació en VÉRTICE, la conexión puede crear CTG One usando únicamente identidad ya verificada.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/auth/ctgone/provision"
            className="rounded-xl bg-[#0A2A66] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#123A7A]"
          >
            Ir a CTG One
          </Link>
          <Link
            href="/auth/ctgone/start"
            className="rounded-xl border border-[#CBD7E6] bg-white px-4 py-2.5 text-xs font-extrabold text-[#0A2A66] transition hover:bg-[#F7F9FC]"
          >
            Conectar desde CTG One
          </Link>
        </div>
      </div>
    </section>
  )
}

import Link from 'next/link'
import { Blocks, Clock, Database, Mail, Share2, ShieldCheck, Target, UserCheck } from 'lucide-react'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'Política de privacidad | VÉRTICE OS',
  description: 'Qué datos recopila VÉRTICE OS, para qué los usa, con quién los comparte y cómo eliminarlos.',
}

const DATA_COLLECTED = [
  { title: 'Cuenta', body: 'Correo electrónico y contraseña, almacenada como hash — nunca en texto plano.' },
  { title: 'Identidad', body: 'Tu número de documento se convierte en un hash irreversible antes de guardarse; nunca almacenamos el número en texto plano.' },
  { title: 'Perfil público', body: 'Nombre a mostrar, municipio o barrio que declaras y, si la subes, tu foto de perfil.' },
  { title: 'Reportes ciudadanos', body: 'Ubicación GPS del hecho, categoría, descripción y evidencia fotográfica que adjuntes voluntariamente.' },
  { title: 'Fotos', body: 'Las imágenes de perfil y evidencia se suben directamente a nuestro proveedor de almacenamiento de imágenes (Cloudflare Images); nuestros servidores no retienen una copia adicional de los bytes.' },
  { title: 'Notificaciones push', body: 'Un identificador de tu dispositivo para poder enviarte notificaciones, si las activas.' },
  { title: 'Federación CTG One (opcional)', body: 'Si eliges "Continuar con CTG One" recibimos un identificador de esa cuenta y el correo asociado al vincularla — nunca tu contraseña de CTG One.' },
  { title: 'Billetera blockchain (opcional)', body: 'Una dirección pública, si decides vincular una.' },
  { title: 'Datos técnicos', body: 'Dirección IP y metadatos de solicitud, usados de forma transitoria para seguridad y prevención de abuso.' },
] as const

const USES = [
  'Operar tu cuenta, sesión y autenticación.',
  'Mostrar y dar seguimiento a tus reportes y acciones cívicas en el territorio correspondiente.',
  'Calcular reputación cívica a partir de evidencia y resultados — nunca de dinero, seguidores o popularidad.',
  'Enviarte notificaciones sobre el estado de tus reportes, propuestas o campañas, si las activaste.',
  'Seguridad de la plataforma y prevención de fraude/abuso.',
  'Cumplir obligaciones legales y contables aplicables.',
] as const

const SHARED_WITH = [
  { name: 'Cloudflare', purpose: 'almacenamiento y entrega de imágenes (perfil y evidencia de reportes).' },
  { name: 'Railway', purpose: 'infraestructura de base de datos y servidor de la API.' },
  { name: 'Expo, Google y Apple', purpose: 'entrega técnica de notificaciones push.' },
  { name: 'CTG One', purpose: 'únicamente si eliges vincular tu cuenta mediante federación.' },
  { name: 'Proveedores de verificación de identidad y de pagos', purpose: 'hoy no están certificados para producción en VÉRTICE; si se activan, esta política se actualizará antes de que empiecen a procesar tus datos.' },
] as const

export default function PrivacyPolicyPage() {
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
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Política de privacidad</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
              VÉRTICE OS es operado por <strong className="text-white">CTG One Corporation</strong>. Este documento describe, en lenguaje llano, qué datos recopilamos en la plataforma cívica (web y aplicación móvil), para qué los usamos, con quién los compartimos y cómo puedes eliminarlos.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-5 py-14 sm:px-6">
          <section>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EDF4FC] text-[#246CB6]"><Database size={19} /></span>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0A2A66]">Qué datos recopilamos</h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {DATA_COLLECTED.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#E1E7EF] bg-[#FAFBFD] p-5">
                  <div className="text-sm font-extrabold text-[#0A2A66]">{item.title}</div>
                  <p className="mt-2 text-[13px] leading-6 text-[#607087]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF9E6] text-[#B98600]"><Target size={19} /></span>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0A2A66]">Para qué los usamos</h2>
            </div>
            <ul className="mt-6 space-y-3">
              {USES.map((use) => (
                <li key={use} className="flex items-start gap-3 text-sm leading-6 text-[#43506A]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4A90E2]" />
                  {use}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-14">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F2F8F3] text-[#2BA745]"><Share2 size={19} /></span>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0A2A66]">Con quién compartimos datos</h2>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#607087]">
              No vendemos tus datos personales. Compartimos datos únicamente con proveedores que operan la infraestructura del servicio, bajo instrucciones nuestras:
            </p>
            <div className="mt-5 space-y-3">
              {SHARED_WITH.map((entry) => (
                <div key={entry.name} className="rounded-2xl border border-[#E1E7EF] p-4">
                  <span className="text-sm font-extrabold text-[#0A2A66]">{entry.name}</span>
                  <span className="text-sm text-[#607087]"> — {entry.purpose}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border border-[#DDE5EF] bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EDF4FC] text-[#246CB6]"><Blocks size={19} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-[#0A2A66]">Blockchain</h2>
              <p className="mt-3 text-sm leading-6 text-[#607087]">
                Si tu municipio usa contratos en blockchain, estos nunca almacenan tu documento de identidad, correo, información personal identificable ni el sentido individual de tu voto.
              </p>
            </div>
            <div className="rounded-3xl border border-[#E5DDD5] bg-[#FFFDF9] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FCEBED] text-[#A91D2E]"><UserCheck size={19} /></span>
              <h2 className="mt-4 text-lg font-extrabold text-[#6E3B32]">Separación de identidad y voto</h2>
              <p className="mt-3 text-sm leading-6 text-[#665B53]">
                Iniciar sesión, tener reputación alta o vincular CTG One no equivale por sí solo a identidad cívica asegurada para votar; esa validación sigue un proceso independiente y explícito.
              </p>
            </div>
          </section>

          <section className="mt-14 rounded-3xl border border-[#DDE5EF] bg-[#FAFBFD] p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0A2A66] shadow-sm"><Clock size={19} /></span>
              <h2 className="text-xl font-extrabold text-[#0A2A66]">Cuánto tiempo conservamos tus datos</h2>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#526174]">
              Mientras tu cuenta esté activa, conservamos los datos necesarios para operar el servicio. Puedes eliminar tu cuenta en cualquier momento desde la app o la web — ver{' '}
              <Link href="/account-deletion" className="font-bold text-[#0A2A66] underline underline-offset-4">cómo eliminar tu cuenta</Link>. Esa eliminación borra de forma irreversible tu correo, contraseña, hash de documento, sesiones, identidades federadas, dispositivos push y perfil público. Algunos registros cívicos, financieros o de auditoría pueden conservarse de forma seudonimizada — sin tus identificadores directos — cuando la ley, la integridad histórica o la prevención de fraude lo requieran.
            </p>
          </section>

          <section className="mt-14">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EDF4FC] text-[#246CB6]"><Mail size={19} /></span>
              <h2 className="text-xl font-extrabold text-[#0A2A66]">Tus derechos</h2>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#607087]">
              Puedes acceder a tu información desde tu perfil, corregir tus datos de cuenta y solicitar la eliminación de tu cuenta en cualquier momento sin necesidad de contactar soporte. Para cualquier otra solicitud relacionada con tus datos, escríbenos a{' '}
              <a href="mailto:privacidad@ctgone.com" className="font-bold text-[#0A2A66] underline underline-offset-4">privacidad@ctgone.com</a>.
            </p>
          </section>

          <div className="mt-14 flex items-start gap-3 rounded-2xl border border-[#E1E7EF] bg-white p-5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#7B8799]" />
            <p className="text-xs leading-6 text-[#7B8799]">
              Última actualización: este documento se genera a partir del comportamiento real y verificado del código de la plataforma en la fecha de publicación. CTG One Corporation puede actualizar esta política cuando cambien las capacidades del producto; los cambios materiales se reflejarán aquí antes de entrar en vigor.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

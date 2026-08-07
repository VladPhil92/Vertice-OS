import * as Sentry from '@sentry/nextjs'

/**
 * Punto de entrada de instrumentación del servidor (Next.js 15+).
 *
 * Bajo Next 14 este archivo no existía y no hacía falta: `withSentryConfig`
 * inyectaba `experimental.instrumentationHook` y cargaba
 * `sentry.server.config.ts` / `sentry.edge.config.ts` por su cuenta. En Next
 * 15 la instrumentación dejó de ser experimental y ese hook desapareció, así
 * que sin este archivo el SDK de Sentry NUNCA se inicializa en el servidor —
 * el build pasa igual y los errores de servidor simplemente dejan de
 * reportarse, en silencio. El propio build lo avisa:
 * "Could not find a Next.js instrumentation file".
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/**
 * Captura errores de renderizado del servidor (Server Components, Route
 * Handlers, middleware). Es un hook nuevo de Next 15 — en 14 no existía
 * equivalente, así que estos errores no llegaban a Sentry.
 */
export const onRequestError = Sentry.captureRequestError

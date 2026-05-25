import * as Sentry from '@sentry/node'
import { config } from '../config'

const SENTRY_DSN = process.env.SENTRY_DSN ?? ''

export function initSentry(): void {
  if (!SENTRY_DSN || config.NODE_ENV === 'test') return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: config.NODE_ENV,
    release: process.env.npm_package_version,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    // PII: never send user emails or cédula hashes to Sentry
    beforeSend(event) {
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      return event
    },
  })
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!SENTRY_DSN) return
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(err)
  })
}

export { Sentry }

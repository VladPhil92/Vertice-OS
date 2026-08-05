const isProd = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, msg: string, extra?: unknown): void {
  if (isTest) return
  if (isProd) {
    process.stdout.write(
      JSON.stringify({ level, time: Date.now(), msg, ...(extra !== undefined && { extra }) }) + '\n',
    )
    return
  }
  const fn = level === 'error' ? console.error : console.info
  fn(`[${level.toUpperCase()}] ${msg}`, extra !== undefined ? extra : '')
}

export const logger = {
  debug: (msg: string, extra?: unknown) => write('debug', msg, extra),
  info:  (msg: string, extra?: unknown) => write('info',  msg, extra),
  warn:  (msg: string, extra?: unknown) => write('warn',  msg, extra),
  error: (msg: string, extra?: unknown) => write('error', msg, extra),
}

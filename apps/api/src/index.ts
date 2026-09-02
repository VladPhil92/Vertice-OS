// ── Entry point sentinel ───────────────────────────────────────────────
// Keep this before loading application modules so Railway always receives
// at least one synchronous boot diagnostic even if module evaluation fails.
process.stderr.write(
  `[boot] ENTRY POINT REACHED pid=${process.pid} node=${process.version} at=${new Date().toISOString()}\n`,
)

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

const MAIN_TIMEOUT_MS = 30_000

function withDeadline<T>(label: string, work: Promise<T>, timeoutMs: number): Promise<T> {
  const start = Date.now()
  let timer: NodeJS.Timeout | undefined

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Date.now() - start}ms (limit ${timeoutMs}ms)`))
    }, timeoutMs)
  })

  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function loadModules() {
  try {
    console.error('[boot] loading modules...')

    const appModule = await import('./app')
    console.error('[boot] loaded ./app')

    const configModule = await import('./config')
    console.error('[boot] loaded ./config')

    const prismaModule = await import('./lib/prisma')
    console.error('[boot] loaded ./lib/prisma')

    const redisModule = await import('./lib/redis')
    const redis = redisModule.redis
    console.error(
      '[boot] loaded ./lib/redis, initial status=',
      redis.status,
      'lazyConnect=',
      (redis as unknown as { options?: { lazyConnect?: boolean } }).options?.lazyConnect,
      'enableReadyCheck=',
      (redis as unknown as { options?: { enableReadyCheck?: boolean } }).options?.enableReadyCheck,
    )

    const neo4jModule = await import('./lib/neo4j')
    console.error('[boot] loaded ./lib/neo4j')

    const jobsModule = await import('./lib/jobs')
    console.error('[boot] loaded ./lib/jobs')

    console.error('[boot] all modules loaded ok')

    return {
      buildApp: appModule.buildApp,
      config: configModule.config,
      prisma: prismaModule.prisma,
      redis,
      closeNeo4j: neo4jModule.closeNeo4j,
      startJobWorker: jobsModule.startJobWorker,
    }
  } catch (err) {
    console.error('[fatal] import-time error while loading modules', err)
    throw err
  }
}

async function main() {
  const { buildApp, config, prisma, redis, closeNeo4j, startJobWorker } = await loadModules()

  console.error('[boot] main() start, PORT=', config.PORT, 'HOST=', config.HOST)
  const app = buildApp()
  console.error('[boot] buildApp() returned, calling listen()')

  // Bind the HTTP socket before warming external dependencies. Railway can
  // distinguish "process is alive but a required dependency is down" from
  // "the process never listened". Readiness remains fail-closed: Redis and
  // Postgres still have to pass /health/ready before the release is live.
  try {
    console.error('[boot] app.listen() pre-call, port=', config.PORT, 'host=', config.HOST)
    await app.listen({ port: config.PORT, host: config.HOST })
    console.error('[boot] app.listen() post-call: resolved successfully')
  } catch (err) {
    console.error('[boot] app.listen() post-call: rejected', err)
    throw err
  }

  app.log.info(
    {
      host: config.HOST,
      port: config.PORT,
      revision: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'unknown',
    },
    '[http] listening',
  )

  try {
    console.error('[boot] redis status before connect:', redis.status)
    if (redis.status === 'wait') await redis.connect()
    await redis.ping()
    app.log.info('[redis] connected')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[boot] redis connect/ping failed:', message)
    app.log.warn({ message }, '[redis] initial connection unavailable; readiness remains blocked')
  }

  const stopJobWorker = startJobWorker()
  app.log.info('[jobs] worker started')

  const shutdown = async (signal: string) => {
    app.log.info(`[shutdown] ${signal} received`)
    stopJobWorker()
    await app.close()
    await prisma.$disconnect()
    if (redis.status !== 'end') await redis.quit()
    await closeNeo4j()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  console.error('[boot] main() finished setup; process is now serving requests')
}

withDeadline('main()', main(), MAIN_TIMEOUT_MS).catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})

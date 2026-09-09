// ── Entry point sentinel ───────────────────────────────────────────────
// Keep this before loading application modules so Railway always receives
// at least one synchronous boot diagnostic even if module evaluation fails.
process.stderr.write(
  `[boot] ENTRY POINT REACHED pid=${process.pid} node=${process.version} at=${new Date().toISOString()}\n`,
)

// Fatal process-level errors are not safe to continue serving after. Keeping a
// process alive after an uncaught exception can leave partially mutated state,
// duplicate workers, or broken provider clients behind a green container.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal:unhandledRejection]', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[fatal:uncaughtException]', err)
  process.exit(1)
})

const MAIN_TIMEOUT_MS = 30_000
const SHUTDOWN_TIMEOUT_MS = 15_000

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

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      app.log.warn({ signal }, '[shutdown] duplicate signal ignored')
      return
    }
    shuttingDown = true

    app.log.info({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, '[shutdown] draining runtime')
    const forceExitTimer = setTimeout(() => {
      app.log.error({ signal }, '[shutdown] deadline exceeded; forcing non-zero exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceExitTimer.unref()

    let exitCode = 0
    try {
      stopJobWorker()
      await app.close()

      const cleanupResults = await Promise.allSettled([
        prisma.$disconnect(),
        redis.status === 'end' ? Promise.resolve() : redis.quit(),
        closeNeo4j(),
      ])

      cleanupResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          exitCode = 1
          const dependency = ['postgres', 'redis', 'neo4j'][index]
          const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
          app.log.error({ dependency, message }, '[shutdown] dependency cleanup failed')
        }
      })
    } catch (err) {
      exitCode = 1
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ message }, '[shutdown] drain failed')
    } finally {
      clearTimeout(forceExitTimer)
      process.exit(exitCode)
    }
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  console.error('[boot] main() finished setup; process is now serving requests')
}

withDeadline('main()', main(), MAIN_TIMEOUT_MS).catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})

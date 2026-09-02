import { buildApp } from './app'
import { config } from './config'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import { closeNeo4j } from './lib/neo4j'
import { startJobWorker } from './lib/jobs'

async function main() {
  const app = buildApp()

  // Bind the HTTP socket before warming external dependencies. Railway can
  // now distinguish "process is alive but a required dependency is down"
  // from "the process never listened". Readiness remains fail-closed: Redis
  // and Postgres still have to pass /health/ready before the release is live.
  await app.listen({ port: config.PORT, host: config.HOST })
  app.log.info({
    host: config.HOST,
    port: config.PORT,
    revision: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'unknown',
  }, '[http] listening')

  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.ping()
    app.log.info('[redis] connected')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
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
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})

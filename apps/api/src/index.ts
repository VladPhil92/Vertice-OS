import { buildApp } from './app'
import { config } from './config'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import { closeNeo4j } from './lib/neo4j'

async function main() {
  const app = buildApp()

  await redis.connect()
  app.log.info('[redis] connected')

  await app.listen({ port: config.PORT, host: config.HOST })

  const shutdown = async (signal: string) => {
    app.log.info(`[shutdown] ${signal} received`)
    await app.close()
    await prisma.$disconnect()
    await redis.quit()
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

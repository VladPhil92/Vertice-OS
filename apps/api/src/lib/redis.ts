import Redis from 'ioredis'
import { config } from '../config'
import { logger } from './logger'

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
})

redis.on('error', (err) => {
  logger.error('[redis] connection error', (err as Error).message)
})

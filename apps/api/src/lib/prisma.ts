import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function withPoolConfig(url: string | undefined): string | undefined {
  if (!url || url.includes('connection_limit')) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}connection_limit=10&pool_timeout=20`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    datasources: { db: { url: withPoolConfig(process.env.DATABASE_URL) } },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

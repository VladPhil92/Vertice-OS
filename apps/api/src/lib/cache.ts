import { redis } from './redis'

const NS = 'vertice'

function cacheKey(namespace: string, id: string): string {
  return `${NS}:${namespace}:${id}`
}

export async function getCache<T>(namespace: string, id: string): Promise<T | null> {
  const raw = await redis.get(cacheKey(namespace, id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function setCache<T>(
  namespace: string,
  id: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(cacheKey(namespace, id), JSON.stringify(value), 'EX', ttlSeconds)
}

export async function delCache(namespace: string, id: string): Promise<void> {
  await redis.del(cacheKey(namespace, id))
}

// TTLs centralizados — cambiar aquí afecta todos los usos
export const TTL = {
  PROFILE: 300,         // 5 min — perfil del ciudadano (datos estables)
  SESSION: 60,          // 1 min — validación de sesión activa
  REPORT: 120,          // 2 min — reporte territorial individual
  STATS: 600,           // 10 min — estadísticas agregadas
  CONVERSATION: 14_400, // 4 h — historial conversación IA
  NOTIFICATION: 604_800, // 7 días — notificaciones ciudadano
} as const

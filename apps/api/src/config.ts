import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),       // 15 min
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().int().positive().default(604800),   // 7 días

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  NEO4J_URI:      z.string().default('bolt://localhost:7687'),
  NEO4J_USER:     z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('vertice'),
  NEO4J_DATABASE: z.string().default('neo4j'),

  AI_SERVICE_URL:    z.string().url().default('http://localhost:8001'),
  AI_SERVICE_SECRET: z.string().default(''),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variables de entorno inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

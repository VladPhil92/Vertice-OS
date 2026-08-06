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

  // ── Blockchain (Polygon) — opcionales: si no están, el minting se omite ──
  POLYGON_RPC_URL:        z.string().url().optional(),
  POLYGON_PRIVATE_KEY:    z.string().optional(),
  CIVIC_SBT_ADDRESS:      z.string().optional(),
  VOTING_REGISTRY_ADDRESS: z.string().optional(),
  // Secreto usado para derivar el compromiso del DID que se escribe on-chain.
  // Es permanente por despliegue: rotarlo rompe la correspondencia con los
  // badges ya emitidos.
  DID_COMMITMENT_PEPPER:  z.string().min(32).optional(),
  IPFS_GATEWAY:           z.string().url().default('https://ipfs.io/ipfs'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Variables de entorno inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

// El servicio de IA rechaza llamadas internas sin X-Service-Key. Sin este
// secreto la API arrancaría "bien" y solo fallaría al primer uso de IA, así
// que se comprueba aquí para que el error salga en el despliegue.
if (parsed.data.NODE_ENV === 'production' && !parsed.data.AI_SERVICE_SECRET) {
  console.error(
    'AI_SERVICE_SECRET es obligatorio en producción: sin él las llamadas al ' +
    'servicio de IA serán rechazadas.',
  )
  process.exit(1)
}

// El compromiso del DID es lo único que se escribe on-chain en lugar del DID
// en claro. Si hay blockchain configurada pero falta el pepper, el minting
// fallaría en caliente; mejor detectarlo al arrancar.
if (parsed.data.CIVIC_SBT_ADDRESS && !parsed.data.DID_COMMITMENT_PEPPER) {
  console.error(
    'DID_COMMITMENT_PEPPER es obligatorio cuando CIVIC_SBT_ADDRESS está ' +
    'configurado: sin él no puede derivarse el compromiso del DID.',
  )
  process.exit(1)
}

export const config = parsed.data

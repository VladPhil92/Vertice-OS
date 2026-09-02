import { z } from 'zod'

// Confirms this module is actually being evaluated. If this line never shows
// up in Railway's deploy logs, the process died before config.ts loaded at
// all (e.g. during the Prisma migration step), not because of a validation
// failure below.
process.stdout.write('[config] parsing environment variables...\n')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),       // 15 min
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().int().positive().default(604800),   // 7 días

  // Claves separadas de JWT_SECRET a propósito — un dominio criptográfico por
  // uso, para que rotar JWT_SECRET (p.ej. tras un incidente de sesión) no
  // invalide silenciosamente el historial de nulificadores de voto ni la
  // protección de las cédulas ya almacenadas.
  VOTE_NULLIFIER_SECRET: z.string().min(32).optional(),
  IDENTITY_PEPPER:       z.string().min(32).optional(),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  NEO4J_URI:      z.string().default('bolt://localhost:7687'),
  NEO4J_USER:     z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default('vertice'),
  NEO4J_DATABASE: z.string().default('neo4j'),

  AI_SERVICE_URL:    z.string().url().default('http://localhost:8001'),
  AI_SERVICE_SECRET: z.string().default(''),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // CTG One federation. The endpoint remains fail-closed when the shared
  // service secret is absent, so deploying the code never enables SSO by accident.
  CTG_ONE_FEDERATION_EXCHANGE_URL: z.string().url().default('https://ctgone.com/api/federation/vertice/exchange'),
  CTG_ONE_FEDERATION_SECRET: z.string().min(32).optional(),

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
  const fieldErrors = parsed.error.flatten().fieldErrors
  const details = Object.entries(fieldErrors)
    .map(([field, errors]) => `  - ${field}: ${(errors ?? []).join('; ') || 'invalid value'}`)
    .join('\n')
  process.stdout.write(
    '[config] FATAL: invalid environment variables. The process will exit now.\n' +
    'The following variable(s) are missing or fail validation:\n' +
    `${details}\n` +
    'Set the required value(s) in the Railway service Variables tab and redeploy.\n',
  )
  process.exit(1)
}

// El servicio de IA rechaza llamadas internas sin X-Service-Key. Sin este
// secreto la API arrancaría "bien" y solo fallaría al primer uso de IA, así
// que se comprueba aquí para que el error salga en el despliegue.
if (parsed.data.NODE_ENV === 'production' && !parsed.data.AI_SERVICE_SECRET) {
  process.stdout.write(
    '[config] FATAL: AI_SERVICE_SECRET is missing. The process will exit now.\n' +
    'Requirement: AI_SERVICE_SECRET must be a non-empty string when NODE_ENV=production.\n' +
    'Current value: unset (defaults to an empty string, which fails this check).\n' +
    'Without it, every call from the API to the AI service will be rejected ' +
    '(missing X-Service-Key).\n' +
    'Fix: set AI_SERVICE_SECRET in the Railway service Variables tab and redeploy.\n',
  )
  process.exit(1)
}

// Sin estas dos, el código cae a derivar la clave desde JWT_SECRET — aceptable
// para desarrollo local, pero en producción reutilizar JWT_SECRET colapsa
// dominios criptográficos distintos (sesiones, nulificadores de voto,
// protección de cédulas) en un único secreto.
if (parsed.data.NODE_ENV === 'production') {
  const missing: string[] = []
  if (!parsed.data.VOTE_NULLIFIER_SECRET) missing.push('VOTE_NULLIFIER_SECRET')
  if (!parsed.data.IDENTITY_PEPPER)       missing.push('IDENTITY_PEPPER')
  if (missing.length > 0) {
    process.stdout.write(
      `[config] FATAL: ${missing.join(', ')} missing. The process will exit now.\n` +
      `Requirement: ${missing.join(' and ')} must be a string of at least 32 ` +
      'characters when NODE_ENV=production.\n' +
      `Current value: unset for ${missing.join(', ')}.\n` +
      'Without them, the API would silently fall back to reusing JWT_SECRET for ' +
      'these purposes, collapsing cryptographic domains that must stay separate ' +
      '(sessions, vote nullifiers, ID document protection).\n' +
      `Fix: set ${missing.join(' and ')} in the Railway service Variables tab and ` +
      'redeploy.\n',
    )
    process.exit(1)
  }
}

// El compromiso del DID es lo único que se escribe on-chain en lugar del DID
// en claro. Si hay blockchain configurada pero falta el pepper, el minting
// fallaría en caliente; mejor detectarlo al arrancar.
if (parsed.data.CIVIC_SBT_ADDRESS && !parsed.data.DID_COMMITMENT_PEPPER) {
  process.stdout.write(
    '[config] FATAL: DID_COMMITMENT_PEPPER is missing. The process will exit now.\n' +
    'Requirement: DID_COMMITMENT_PEPPER must be a string of at least 32 characters ' +
    'whenever CIVIC_SBT_ADDRESS is configured.\n' +
    `Current value: CIVIC_SBT_ADDRESS=${parsed.data.CIVIC_SBT_ADDRESS}, ` +
    'DID_COMMITMENT_PEPPER=unset.\n' +
    'Without it, the DID commitment written on-chain cannot be derived.\n' +
    'Fix: set DID_COMMITMENT_PEPPER in the Railway service Variables tab and redeploy.\n',
  )
  process.exit(1)
}

export const config = parsed.data

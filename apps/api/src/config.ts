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

  // Proveedores que VÉRTICE acepta como prueba externa de identidad para
  // acciones de gobernanza de alto impacto. Es una allowlist explícita:
  // federación/SSO (por ejemplo el provider persistido `ctg_one`) NO equivale
  // a identidad asegurada salvo que el operador lo incluya conscientemente
  // después de auditar su proceso real de identity proofing.
  // Formato: "provider_a,provider_b". Vacío = fail-closed para identidad cívica.
  CIVIC_IDENTITY_ASSURANCE_PROVIDERS: z.string().default('').transform((value) =>
    Array.from(new Set(
      value
        .split(',')
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean),
    )),
  ),

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
    '[config] FATAL: invalid core environment variables. The process will exit now.\n' +
    'The following variable(s) are missing or fail validation:\n' +
    `${details}\n` +
    'Set the required value(s) in the Railway service Variables tab and redeploy.\n',
  )
  process.exit(1)
}

// Feature-scoped secrets do not decide whether the entire API can boot.
// In production their consumers fail closed with 503 (see feature-secrets.ts)
// instead of silently falling back to JWT_SECRET or taking unrelated modules
// offline. This keeps the platform available while preserving crypto-domain
// separation and makes missing feature configuration visible at the exact
// capability boundary that needs it.
if (parsed.data.NODE_ENV === 'production') {
  const degraded: string[] = []
  if (!parsed.data.AI_SERVICE_SECRET)      degraded.push('AI_SERVICE_SECRET → civic AI disabled')
  if (!parsed.data.VOTE_NULLIFIER_SECRET) degraded.push('VOTE_NULLIFIER_SECRET → voting disabled')
  if (!parsed.data.IDENTITY_PEPPER)       degraded.push('IDENTITY_PEPPER → document identity disabled')

  if (degraded.length > 0) {
    process.stdout.write(
      '[config] WARNING: API booting with degraded feature capabilities.\n' +
      degraded.map((item) => `  - ${item}`).join('\n') + '\n' +
      'Affected endpoints fail closed with HTTP 503; no feature secret falls back to JWT_SECRET in production.\n' +
      'Set the missing value(s) in Railway Variables and redeploy to restore full capability.\n',
    )
  }
}

// El compromiso del DID es lo único que se escribe on-chain en lugar del DID
// en claro. Si blockchain está explícitamente configurada pero falta el pepper,
// esa configuración es internamente inválida y debe impedir el arranque.
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
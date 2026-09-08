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
  JWT_ACCESS_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRY_SECONDS: z.coerce.number().int().positive().default(604800),

  // Claves separadas de JWT_SECRET a propósito — un dominio criptográfico por
  // uso, para que rotar JWT_SECRET no invalide silenciosamente nulificadores
  // de voto ni la protección de identidades ya almacenadas.
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
  // acciones de gobernanza de alto impacto. Vacío = fail-closed.
  CIVIC_IDENTITY_ASSURANCE_PROVIDERS: z.string().default('').transform((value) =>
    Array.from(new Set(
      value
        .split(',')
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean),
    )),
  ),
  // P0.9: promoción explícita de providers que ya completaron certificación
  // externa. Para adapters nativos, estar compilado + credentialed + allowlisted
  // NO basta para otorgar autoridad de gobernanza hasta aparecer aquí.
  CIVIC_IDENTITY_CERTIFIED_PROVIDERS: z.string().default('').transform((value) =>
    Array.from(new Set(
      value
        .split(',')
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean),
    )),
  ),
  // Contrato legacy P0.2. Se conserva temporalmente para una migración de
  // configuración sin ruptura, pero P0.4 ya no lo usa para autenticar ingress.
  CIVIC_IDENTITY_PROOFING_EVENT_SECRET: z.string().min(32).optional(),
  // Registro JSON feature-scoped de llaves HMAC por proveedor y key-id para el
  // salto interno adapter→VÉRTICE. Los adapters nativos directos P0.7+ usan sus
  // propias credenciales del proveedor y no dependen de este keyset.
  CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON: z.string().default(''),

  // Veriff P0.8 — todas son feature-scoped. Su ausencia no tumba la API y
  // mantiene el provider fail-closed. Base URL se obtiene del Customer Portal
  // porque Veriff la asigna por integración.
  VERIFF_BASE_URL: z.string().url().optional(),
  VERIFF_API_KEY: z.string().min(8).optional(),
  VERIFF_SHARED_SECRET: z.string().min(16).optional(),
  VERIFF_CALLBACK_URL: z.string().url().optional(),
  VERIFF_REVOCATION_STATUS_CODE: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/).default('vertice_revoked'),

  // Civic profile identity media. Optional and feature-scoped: without these
  // values the profile API remains available but avatar uploads fail closed.
  // Cloudflare Images direct uploads keep image bytes out of the API process.
  CLOUDFLARE_IMAGES_ACCOUNT_ID: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(),
  CLOUDFLARE_IMAGES_API_TOKEN: z.string().min(20).optional(),
  CLOUDFLARE_IMAGES_DELIVERY_URL: z.string().url().optional(),
  CLOUDFLARE_IMAGES_VARIANT: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('public'),

  // ── Pagos (Mercado Pago) — capability opcional/fail-closed ───────────────
  // Ninguna credencial de pagos es core para arrancar la API. Si el set está
  // incompleto, /health/ready reporta degradación y los endpoints monetarios
  // rechazan operaciones sin afectar participación cívica gratuita.
  MERCADOPAGO_ACCESS_TOKEN: z.string().min(20).optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().min(16).optional(),
  PAYMENTS_WEB_URL: z.string().url().optional(),
  PAYMENTS_WEBHOOK_URL: z.string().url().optional(),
  MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
  CROWDFUNDING_PAYMENTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

  // ── Desembolsos (Wompi Pagos a Terceros) — capability separada ──────────
  // El adapter puede certificarse en sandbox sin habilitar desembolsos reales.
  // Los datos bancarios del beneficiario son transitorios: VÉRTICE persiste
  // únicamente una huella HMAC y referencias no sensibles del proveedor.
  WOMPI_PAYOUTS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  WOMPI_PAYOUTS_API_KEY: z.string().min(16).optional(),
  WOMPI_PAYOUTS_USER_PRINCIPAL_ID: z.string().uuid().optional(),
  WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID: z.string().uuid().optional(),
  WOMPI_PAYOUTS_EVENT_SECRET: z.string().min(16).optional(),
  PAYOUT_DESTINATION_PEPPER: z.string().min(32).optional(),
  CROWDFUNDING_PAYOUTS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),

  // ── Blockchain (Polygon) — capacidades opcionales ─────────────────
  POLYGON_RPC_URL:          z.string().url().optional(),
  POLYGON_PRIVATE_KEY:      z.string().optional(),
  CIVIC_SBT_ADDRESS:        z.string().optional(),
  VOTING_REGISTRY_ADDRESS:  z.string().optional(),
  DID_COMMITMENT_PEPPER:    z.string().min(32).optional(),
  IPFS_GATEWAY:             z.string().url().default('https://ipfs.io/ipfs'),
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

// Feature-scoped configuration never decides whether the entire API can boot.
// Missing/partial optional capabilities fail closed at their feature boundary;
// /health/ready exposes their coarse state without logging or returning secrets.
export const config = parsed.data

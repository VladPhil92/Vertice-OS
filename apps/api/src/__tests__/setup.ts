// Env vars requeridas por config.ts — deben estar antes de cualquier import del módulo
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_vertice'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters-ok'
process.env.CORS_ORIGIN = 'http://localhost:3000'
process.env.NEO4J_URI = 'bolt://localhost:7687'
process.env.NEO4J_USER = 'neo4j'
process.env.NEO4J_PASSWORD = 'vertice'
// Claves separadas de JWT_SECRET — ver config.ts
process.env.VOTE_NULLIFIER_SECRET = 'test-nullifier-secret-32-chars-min!!'
process.env.IDENTITY_PEPPER = 'test-identity-pepper-32-chars-min!!'
// Proveedor ficticio exclusivo del entorno de test. Producción conserva el
// default fail-closed (allowlist vacía) hasta integrar y auditar un proveedor real.
process.env.CIVIC_IDENTITY_ASSURANCE_PROVIDERS = 'trusted_kyc'
// P0.4: un proveedor trusted solo es operacional si también existe una llave
// de ingress provider-scoped. Este secreto es exclusivamente de fixtures.
process.env.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
  trusted_kyc: { test: 'test-proofing-adapter-secret-32-chars!!' },
})
// Pepper del compromiso del DID — el contrato nunca recibe el DID en claro
process.env.DID_COMMITMENT_PEPPER = 'test-pepper-with-at-least-32-characters!!'

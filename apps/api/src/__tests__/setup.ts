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
// Proveedor sintético exclusivo de test/desarrollo. El registro de adaptadores
// lo excluye de forma absoluta cuando NODE_ENV=production.
process.env.CIVIC_IDENTITY_ASSURANCE_PROVIDERS = 'trusted_kyc'
process.env.CIVIC_IDENTITY_PROOFING_ADAPTER_KEYS_JSON = JSON.stringify({
  trusted_kyc: { 'test-key': 'test-proofing-provider-key-32-characters!!' },
})
// Contrato legacy, conservado sólo para certificar compatibilidad de config.
process.env.CIVIC_IDENTITY_PROOFING_EVENT_SECRET = 'test-proofing-event-secret-32-chars!!'
// Pepper del compromiso del DID — el contrato nunca recibe el DID en claro
process.env.DID_COMMITMENT_PEPPER = 'test-pepper-with-at-least-32-characters!!'

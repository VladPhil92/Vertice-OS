// Env vars requeridas por config.ts — deben estar antes de cualquier import del módulo
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_vertice'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters-ok'
process.env.CORS_ORIGIN = 'http://localhost:3000'
process.env.NEO4J_URI = 'bolt://localhost:7687'
process.env.NEO4J_USER = 'neo4j'
process.env.NEO4J_PASSWORD = 'vertice'
// Pepper del compromiso del DID — el contrato nunca recibe el DID en claro
process.env.DID_COMMITMENT_PEPPER = 'test-pepper-with-at-least-32-characters!!'

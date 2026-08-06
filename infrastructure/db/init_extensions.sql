-- VÉRTICE OS — PostgreSQL Extensions
-- Executed once by the postgres container on first start.
-- Tables and seed data are applied by "prisma migrate deploy" in the API service.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

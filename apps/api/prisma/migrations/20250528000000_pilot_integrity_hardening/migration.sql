-- Padrón congelado por consulta: quién estaba habilitado para votar, tomado
-- en el instante debate→voting. El conteo en proposals.eligible_voters ahora
-- se calcula como el número de filas insertadas aquí en la misma transacción.
CREATE TABLE "proposal_voter_roll" (
  "proposal_id"         UUID NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "citizen_id"          UUID NOT NULL REFERENCES "citizens"("id") ON DELETE CASCADE,
  "neighborhood"        TEXT,
  "locality_id"         INTEGER,
  "verification_level"  SMALLINT NOT NULL,
  "eligibility_reason"  TEXT NOT NULL,
  "frozen_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("proposal_id", "citizen_id")
);

-- Cola durable de trabajos: reemplaza el patrón "enviar y olvidar" para mint
-- de badges SBT y registro de resultados de votación on-chain.
CREATE TABLE "jobs" (
  "id"           SERIAL PRIMARY KEY,
  "type"         TEXT NOT NULL,
  "payload"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "last_error"   TEXT,
  "run_after"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_jobs_pending" ON "jobs" ("status", "run_after");

-- Auditoría de acciones administrativas: quién, qué, sobre qué, cuándo,
-- resultado. Solo INSERT desde la aplicación — no hay UPDATE/DELETE expuesto.
CREATE TABLE "admin_audit_log" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"     UUID NOT NULL REFERENCES "citizens"("id") ON DELETE RESTRICT,
  "action"       TEXT NOT NULL,
  "target_type"  TEXT NOT NULL,
  "target_id"    TEXT NOT NULL,
  "result"       TEXT NOT NULL,
  "reason"       TEXT,
  "metadata"     JSONB,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "idx_audit_target" ON "admin_audit_log" ("target_type", "target_id");
CREATE INDEX "idx_audit_actor" ON "admin_audit_log" ("actor_id", "created_at" DESC);

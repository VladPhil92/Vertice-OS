-- Territorio de la propuesta: se toma un snapshot en creación desde el
-- ciudadano autor. Sin esto, el cálculo de quórum contaba a TODOS los
-- ciudadanos verificados de la ciudad para propuestas de barrio/localidad,
-- inflando o desvirtuando el electorado real de la propuesta.
ALTER TABLE "proposals" ADD COLUMN "locality_id" INTEGER;
ALTER TABLE "proposals" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_locality_id_fkey"
  FOREIGN KEY ("locality_id") REFERENCES "localities"("id") ON DELETE SET NULL;
CREATE INDEX "idx_proposals_locality" ON "proposals"("locality_id");

-- Registro durable de avales. Antes la deduplicación vivía solo en un SET de
-- Redis (`vertice:endorsed:<proposalId>`) mientras Postgres únicamente
-- guardaba un contador (`proposals.endorsement_count`). Si Redis perdía
-- datos —expiración, restauración incompleta, migración de cluster—, los
-- ciudadanos podían volver a avalar y el contador de Postgres seguía
-- creciendo sin relación con la realidad. La restricción UNIQUE aquí es la
-- que de verdad impide el doble aval; Redis puede seguir usándose como caché
-- de lectura rápida, pero ya no es la fuente de verdad.
CREATE TABLE "proposal_endorsements" (
  "proposal_id" UUID NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "citizen_id"  UUID NOT NULL REFERENCES "citizens"("id") ON DELETE CASCADE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("proposal_id", "citizen_id")
);

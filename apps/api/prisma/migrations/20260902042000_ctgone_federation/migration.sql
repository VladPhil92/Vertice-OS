-- CTG One ↔ VÉRTICE OS federated identity support.
--
-- A federated account does not imply Colombian identity verification, so
-- cedula_hash becomes nullable. Existing verified/local accounts keep their
-- immutable hash. External provider subjects are mapped durably and uniquely.

ALTER TABLE "citizens"
  ALTER COLUMN "cedula_hash" DROP NOT NULL;

CREATE TABLE "external_identities" (
  "id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "provider_subject" VARCHAR(191) NOT NULL,
  "citizen_id" UUID NOT NULL,
  "email_at_link" VARCHAR(320),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_identities_provider_provider_subject_key"
  ON "external_identities"("provider", "provider_subject");

CREATE INDEX "idx_external_identities_citizen"
  ON "external_identities"("citizen_id");

ALTER TABLE "external_identities"
  ADD CONSTRAINT "external_identities_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

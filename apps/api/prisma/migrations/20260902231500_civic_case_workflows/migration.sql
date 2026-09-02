-- Citizen Dashboard Functional Convergence — Phase II
-- Durable cross-module civic case: territorial report -> AI -> proposal/vote -> public control.

CREATE TABLE "civic_cases" (
    "id"                            UUID          NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id"                    UUID          NOT NULL,
    "source_report_id"              UUID          NOT NULL,
    "proposal_id"                   UUID,
    "legal_document_id"             UUID,
    "stage"                         VARCHAR(30)   NOT NULL DEFAULT 'reported',
    "territorial_analysis"          JSONB,
    "territorial_analysis_audit_id" VARCHAR(36),
    "policy_draft"                  JSONB,
    "policy_draft_audit_id"         VARCHAR(36),
    "created_at"                    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "civic_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "civic_cases_source_report_id_key" ON "civic_cases"("source_report_id");
CREATE UNIQUE INDEX "civic_cases_proposal_id_key" ON "civic_cases"("proposal_id") WHERE "proposal_id" IS NOT NULL;
CREATE UNIQUE INDEX "civic_cases_legal_document_id_key" ON "civic_cases"("legal_document_id") WHERE "legal_document_id" IS NOT NULL;
CREATE INDEX "idx_civic_cases_citizen" ON "civic_cases"("citizen_id", "updated_at" DESC);
CREATE INDEX "idx_civic_cases_stage" ON "civic_cases"("stage", "updated_at" DESC);

ALTER TABLE "civic_cases" ADD CONSTRAINT "civic_cases_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "civic_cases" ADD CONSTRAINT "civic_cases_source_report_id_fkey"
  FOREIGN KEY ("source_report_id") REFERENCES "territorial_reports"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "civic_cases" ADD CONSTRAINT "civic_cases_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "civic_cases" ADD CONSTRAINT "civic_cases_legal_document_id_fkey"
  FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

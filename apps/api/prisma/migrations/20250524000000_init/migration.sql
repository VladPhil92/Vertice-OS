-- VÉRTICE OS — Initial Migration
-- PostgreSQL 16 + PostGIS
-- Generated from prisma/schema.prisma

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── localities ────────────────────────────────────────────────────────────────
CREATE TABLE "localities" (
    "id"                   SERIAL        NOT NULL,
    "name"                 TEXT          NOT NULL,
    "code"                 TEXT          NOT NULL,
    "population_estimate"  INTEGER,
    "area_km2"             DECIMAL(8,2),
    "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "localities_code_key" ON "localities"("code");

INSERT INTO "localities" ("name", "code", "population_estimate") VALUES
  ('Histórica y del Caribe Norte', 'CTG-01', 295000),
  ('De la Virgen y Turística',     'CTG-02', 380000),
  ('Industrial y de la Bahía',     'CTG-03', 315000),
  ('Bayunca',                      'CTG-04',  45000);

-- ── citizens ──────────────────────────────────────────────────────────────────
CREATE TABLE "citizens" (
    "id"                  UUID          NOT NULL DEFAULT gen_random_uuid(),
    "did"                 TEXT          NOT NULL,
    "cedula_hash"         TEXT          NOT NULL,
    "email"               TEXT,
    "password_hash"       TEXT,
    "locality_id"         INTEGER,
    "neighborhood"        TEXT,
    "display_name"        TEXT,
    "verification_level"  SMALLINT      NOT NULL DEFAULT 0,
    "reputation_score"    DECIMAL(10,4) NOT NULL DEFAULT 0,
    "participation_count" INTEGER       NOT NULL DEFAULT 0,
    "is_active"           BOOLEAN       NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at"      TIMESTAMPTZ(6),

    CONSTRAINT "citizens_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "valid_verification"       CHECK ("verification_level" BETWEEN 0 AND 2),
    CONSTRAINT "valid_reputation"         CHECK ("reputation_score" >= 0)
);

CREATE UNIQUE INDEX "citizens_did_key"         ON "citizens"("did");
CREATE UNIQUE INDEX "citizens_cedula_hash_key" ON "citizens"("cedula_hash");
CREATE UNIQUE INDEX "citizens_email_key"       ON "citizens"("email");

CREATE INDEX "idx_citizens_locality"   ON "citizens"("locality_id");
CREATE INDEX "idx_citizens_reputation" ON "citizens"("reputation_score" DESC);
CREATE INDEX "idx_citizens_active"     ON "citizens"("is_active", "last_active_at" DESC);

ALTER TABLE "citizens" ADD CONSTRAINT "citizens_locality_id_fkey"
  FOREIGN KEY ("locality_id") REFERENCES "localities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── sessions ──────────────────────────────────────────────────────────────────
CREATE TABLE "sessions" (
    "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id"         UUID          NOT NULL,
    "refresh_token_hash" TEXT          NOT NULL,
    "expires_at"         TIMESTAMPTZ(6) NOT NULL,
    "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"         TIMESTAMPTZ(6),
    "user_agent"         TEXT,
    "ip_address"         TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
CREATE INDEX "idx_sessions_citizen_id" ON "sessions"("citizen_id");
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── territorial_reports ───────────────────────────────────────────────────────
CREATE TABLE "territorial_reports" (
    "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id"        UUID,
    "category"          TEXT           NOT NULL,
    "subcategory"       TEXT,
    "title"             TEXT           NOT NULL,
    "description"       TEXT           NOT NULL,
    "location"          geography(Point,4326),
    "neighborhood"      TEXT,
    "locality_id"       INTEGER,
    "address_reference" TEXT,
    "urgency_score"     DECIMAL(4,3),
    "sentiment_score"   DECIMAL(4,3),
    "cluster_id"        TEXT,
    "status"            TEXT           NOT NULL DEFAULT 'open',
    "assigned_to"       TEXT,
    "media_urls"        TEXT[]         NOT NULL DEFAULT '{}',
    "ipfs_hash"         TEXT,
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at"       TIMESTAMPTZ(6),

    CONSTRAINT "territorial_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_reports_category"   ON "territorial_reports"("category", "status");
CREATE INDEX "idx_reports_citizen_id" ON "territorial_reports"("citizen_id");
CREATE INDEX "idx_reports_locality"   ON "territorial_reports"("locality_id", "status");
CREATE INDEX "idx_reports_status"     ON "territorial_reports"("status", "created_at" DESC);
CREATE INDEX "idx_reports_location"   ON "territorial_reports" USING GIST("location");

ALTER TABLE "territorial_reports" ADD CONSTRAINT "territorial_reports_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "territorial_reports" ADD CONSTRAINT "territorial_reports_locality_id_fkey"
  FOREIGN KEY ("locality_id") REFERENCES "localities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── proposals ─────────────────────────────────────────────────────────────────
CREATE TABLE "proposals" (
    "id"                      UUID           NOT NULL DEFAULT gen_random_uuid(),
    "author_id"               UUID,
    "title"                   TEXT           NOT NULL,
    "description"             TEXT           NOT NULL,
    "executive_summary"       TEXT,
    "category"                TEXT           NOT NULL,
    "scope"                   TEXT           NOT NULL,
    "status"                  TEXT           NOT NULL DEFAULT 'idea',
    "endorsement_count"       INTEGER        NOT NULL DEFAULT 0,
    "comment_count"           INTEGER        NOT NULL DEFAULT 0,
    "view_count"              INTEGER        NOT NULL DEFAULT 0,
    "quorum_required"         DECIMAL(4,3),
    "approval_threshold"      DECIMAL(4,3),
    "eligible_voters"         INTEGER,
    "total_votes"             INTEGER        NOT NULL DEFAULT 0,
    "approve_votes_weighted"  DECIMAL(12,4)  NOT NULL DEFAULT 0,
    "reject_votes_weighted"   DECIMAL(12,4)  NOT NULL DEFAULT 0,
    "abstain_votes_weighted"  DECIMAL(12,4)  NOT NULL DEFAULT 0,
    "assigned_executor"       TEXT,
    "execution_deadline"      DATE,
    "blockchain_tx_hash"      TEXT,
    "ipfs_proposal_uri"       TEXT,
    "ipfs_result_uri"         TEXT,
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draft_started_at"        TIMESTAMPTZ(6),
    "debate_started_at"       TIMESTAMPTZ(6),
    "voting_starts_at"        TIMESTAMPTZ(6),
    "voting_ends_at"          TIMESTAMPTZ(6),
    "decided_at"              TIMESTAMPTZ(6),

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_proposals_author"   ON "proposals"("author_id");
CREATE INDEX "idx_proposals_category" ON "proposals"("category", "scope");
CREATE INDEX "idx_proposals_status"   ON "proposals"("status", "created_at" DESC);

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "citizens"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── votes ─────────────────────────────────────────────────────────────────────
CREATE TABLE "votes" (
    "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "proposal_id"      UUID           NOT NULL,
    "nullifier_hash"   TEXT           NOT NULL,
    "vote_weight"      DECIMAL(6,4)   NOT NULL,
    "vote_value"       SMALLINT       NOT NULL,
    "is_delegated"     BOOLEAN        NOT NULL DEFAULT false,
    "delegation_depth" SMALLINT       NOT NULL DEFAULT 0,
    "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "votes_nullifier_hash_key" ON "votes"("nullifier_hash");
CREATE INDEX "idx_votes_tally" ON "votes"("proposal_id", "vote_value", "vote_weight");

ALTER TABLE "votes" ADD CONSTRAINT "votes_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── delegations ───────────────────────────────────────────────────────────────
CREATE TABLE "delegations" (
    "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
    "delegator_id"    UUID           NOT NULL,
    "delegate_id"     UUID           NOT NULL,
    "delegation_type" TEXT           NOT NULL,
    "domain"          TEXT,
    "proposal_id"     UUID,
    "is_active"       BOOLEAN        NOT NULL DEFAULT true,
    "valid_from"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until"     TIMESTAMPTZ(6),
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at"      TIMESTAMPTZ(6),

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_delegations_delegator" ON "delegations"("delegator_id", "is_active");
CREATE INDEX "idx_delegations_delegate"  ON "delegations"("delegate_id", "is_active");

ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_fkey"
  FOREIGN KEY ("delegator_id") REFERENCES "citizens"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_id_fkey"
  FOREIGN KEY ("delegate_id") REFERENCES "citizens"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delegations" ADD CONSTRAINT "delegations_proposal_id_fkey"
  FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── reputation_events ─────────────────────────────────────────────────────────
CREATE TABLE "reputation_events" (
    "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id"   UUID           NOT NULL,
    "event_type"   VARCHAR(50)    NOT NULL,
    "points"       INTEGER        NOT NULL,
    "reference_id" VARCHAR(36),
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_reputation_citizen"    ON "reputation_events"("citizen_id", "created_at" DESC);
CREATE INDEX "idx_reputation_event_type" ON "reputation_events"("citizen_id", "event_type");

ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── legal_documents ───────────────────────────────────────────────────────────
CREATE TABLE "legal_documents" (
    "id"                      UUID           NOT NULL DEFAULT gen_random_uuid(),
    "citizen_id"              UUID           NOT NULL,
    "legal_type"              VARCHAR(40)    NOT NULL,
    "status"                  VARCHAR(20)    NOT NULL DEFAULT 'draft',
    "urgency"                 VARCHAR(10)    NOT NULL DEFAULT 'media',
    "situation_description"   TEXT           NOT NULL,
    "evidence_description"    TEXT,
    "location"                VARCHAR(300),
    "evidence_urls"           JSONB          NOT NULL DEFAULT '[]',
    "rights_affected"         JSONB          NOT NULL DEFAULT '[]',
    "target_entity"           JSONB,
    "response_deadline_days"  INTEGER        NOT NULL DEFAULT 15,
    "legal_basis"             JSONB          NOT NULL DEFAULT '[]',
    "alternative_remedies"    JSONB          NOT NULL DEFAULT '[]',
    "next_steps"              JSONB          NOT NULL DEFAULT '[]',
    "legal_orientation"       TEXT           NOT NULL DEFAULT '',
    "ai_audit_id"             VARCHAR(36),
    "document_draft"          TEXT           NOT NULL DEFAULT '',
    "submitted_at"            TIMESTAMPTZ(6),
    "submitted_via"           VARCHAR(10),
    "entity_response"         TEXT,
    "entity_responded_at"     TIMESTAMPTZ(6),
    "response_deadline_at"    TIMESTAMPTZ(6),
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_legal_citizen" ON "legal_documents"("citizen_id", "created_at" DESC);
CREATE INDEX "idx_legal_status"  ON "legal_documents"("citizen_id", "status");
CREATE INDEX "idx_legal_type"    ON "legal_documents"("legal_type", "status");

ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_citizen_id_fkey"
  FOREIGN KEY ("citizen_id") REFERENCES "citizens"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

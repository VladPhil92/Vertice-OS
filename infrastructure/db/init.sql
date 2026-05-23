-- ═══════════════════════════════════════════════════════════════════
-- VÉRTICE OS — Database Init Script
-- PostgreSQL + PostGIS
-- ═══════════════════════════════════════════════════════════════════

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Localidades de Cartagena ─────────────────────────────────────────────────
CREATE TABLE localities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    population_estimate INTEGER,
    area_km2 DECIMAL(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO localities (name, code, population_estimate) VALUES
  ('Histórica y del Caribe Norte', 'CTG-01', 295000),
  ('De la Virgen y Turística', 'CTG-02', 380000),
  ('Industrial y de la Bahía', 'CTG-03', 315000),
  ('Bayunca', 'CTG-04', 45000);

-- ── Ciudadanos verificados ────────────────────────────────────────────────────
CREATE TABLE citizens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    did TEXT UNIQUE NOT NULL,
    cedula_hash TEXT UNIQUE NOT NULL,         -- SHA-256, nunca texto plano
    email TEXT UNIQUE,
    password_hash TEXT,
    locality_id INTEGER REFERENCES localities(id),
    neighborhood TEXT,
    display_name TEXT,                         -- Nombre público (puede ser alias)
    verification_level SMALLINT DEFAULT 0,    -- 0:básico, 1:verificado, 2:validado
    reputation_score DECIMAL(10,4) DEFAULT 0,
    participation_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    CONSTRAINT valid_verification CHECK (verification_level BETWEEN 0 AND 2),
    CONSTRAINT valid_reputation CHECK (reputation_score >= 0)
);

CREATE INDEX idx_citizens_locality ON citizens(locality_id);
CREATE INDEX idx_citizens_reputation ON citizens(reputation_score DESC);
CREATE INDEX idx_citizens_active ON citizens(is_active, last_active_at DESC);
-- Quórum: elegibles por localidad con nivel de verificación mínimo
CREATE INDEX idx_citizens_locality_verification ON citizens(locality_id, verification_level) WHERE is_active = TRUE;

-- ── Reportes territoriales ────────────────────────────────────────────────────
CREATE TABLE territorial_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID REFERENCES citizens(id),
    
    -- Clasificación
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Geoespacial (PostGIS)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    neighborhood TEXT,
    locality_id INTEGER REFERENCES localities(id),
    address_reference TEXT,
    
    -- IA scores
    urgency_score DECIMAL(4,3),               -- 0.0 a 1.0 (ML)
    sentiment_score DECIMAL(4,3),             -- -1.0 a 1.0
    cluster_id TEXT,                           -- HDBSCAN cluster
    
    -- Estado
    status TEXT DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'rejected', 'duplicate')),
    assigned_to TEXT,                          -- Responsable institucional
    
    -- Medios
    media_urls TEXT[],                         -- Fotos/videos en IPFS
    
    -- Blockchain
    ipfs_hash TEXT,                            -- Hash del reporte en IPFS
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_urgency CHECK (urgency_score IS NULL OR urgency_score BETWEEN 0 AND 1)
);

-- Índice espacial (crítico para queries geoespaciales)
CREATE INDEX idx_reports_location ON territorial_reports USING GIST(location);
CREATE INDEX idx_reports_status ON territorial_reports(status, created_at DESC);
CREATE INDEX idx_reports_category ON territorial_reports(category, status);
CREATE INDEX idx_reports_locality ON territorial_reports(locality_id, status);
-- FK sin índice explícito: "todos los reportes de un ciudadano" = full scan sin esto
CREATE INDEX idx_reports_citizen_id ON territorial_reports(citizen_id);
-- Dashboard de urgencia: reportes abiertos ordenados por score ML
CREATE INDEX idx_reports_urgency ON territorial_reports(urgency_score DESC)
    WHERE status IN ('open', 'in_progress') AND urgency_score IS NOT NULL;
-- Agrupación HDBSCAN: traer todos los reportes de un cluster
CREATE INDEX idx_reports_cluster ON territorial_reports(cluster_id)
    WHERE cluster_id IS NOT NULL;

-- ── Propuestas de gobernanza ──────────────────────────────────────────────────
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES citizens(id),
    
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    executive_summary TEXT,
    category TEXT NOT NULL,
    scope TEXT NOT NULL
        CHECK (scope IN ('neighborhood', 'locality', 'city', 'regional', 'national')),
    
    -- Estado del ciclo de vida
    status TEXT DEFAULT 'idea'
        CHECK (status IN ('idea', 'draft', 'debate', 'voting', 'approved', 
                          'rejected', 'executed', 'failed_execution', 'quorum_failed')),
    
    -- Métricas de participación
    endorsement_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    
    -- Parámetros de votación (calculados al entrar en votación)
    quorum_required DECIMAL(4,3),
    approval_threshold DECIMAL(4,3),
    eligible_voters INTEGER,
    
    -- Resultado
    total_votes INTEGER DEFAULT 0,
    approve_votes_weighted DECIMAL(12,4) DEFAULT 0,
    reject_votes_weighted DECIMAL(12,4) DEFAULT 0,
    abstain_votes_weighted DECIMAL(12,4) DEFAULT 0,
    
    -- Responsable de ejecución (si se aprueba)
    assigned_executor TEXT,
    execution_deadline DATE,
    
    -- Blockchain & IPFS
    blockchain_tx_hash TEXT,
    ipfs_proposal_uri TEXT,
    ipfs_result_uri TEXT,
    
    -- Timestamps del ciclo de vida
    created_at TIMESTAMPTZ DEFAULT NOW(),
    draft_started_at TIMESTAMPTZ,
    debate_started_at TIMESTAMPTZ,
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ
);

CREATE INDEX idx_proposals_status ON proposals(status, created_at DESC);
CREATE INDEX idx_proposals_author ON proposals(author_id);
CREATE INDEX idx_proposals_category ON proposals(category, scope);
-- Votaciones activas: encontrar propuestas cuyo período de voto no ha cerrado
CREATE INDEX idx_proposals_voting_ends ON proposals(voting_ends_at)
    WHERE status = 'voting';
-- Ideas trending: ordenar por endorsements en fase de idea/draft
CREATE INDEX idx_proposals_endorsements ON proposals(endorsement_count DESC)
    WHERE status IN ('idea', 'draft');

-- ── Votos ─────────────────────────────────────────────────────────────────────
-- Diseñado para privacidad: el voto individual es opaco
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) NOT NULL,
    
    -- Privacidad: no guardamos el citizen_id directamente
    -- El nullifier_hash previene doble voto sin revelar identidad
    nullifier_hash TEXT UNIQUE NOT NULL,       -- ZKP nullifier
    
    vote_weight DECIMAL(6,4) NOT NULL,         -- Ponderado por reputación
    vote_value SMALLINT NOT NULL               -- 1=favor, -1=contra, 0=abstención
        CHECK (vote_value IN (-1, 0, 1)),
    
    -- Delegación
    is_delegated BOOLEAN DEFAULT FALSE,
    delegation_depth SMALLINT DEFAULT 0,       -- 0=voto directo, 1,2,3=delegaciones
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_weight CHECK (vote_weight > 0 AND vote_weight <= 10)
);

-- Índice cubriente: conteo ponderado de votos sin heap fetch
-- SELECT vote_value, SUM(vote_weight) FROM votes WHERE proposal_id = ? GROUP BY vote_value
CREATE INDEX idx_votes_tally ON votes(proposal_id, vote_value, vote_weight);

-- ── Delegaciones de voto ──────────────────────────────────────────────────────
CREATE TABLE delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID REFERENCES citizens(id) NOT NULL,
    delegate_id UUID REFERENCES citizens(id) NOT NULL,
    
    -- Alcance
    delegation_type TEXT NOT NULL
        CHECK (delegation_type IN ('general', 'domain', 'proposal', 'temporal')),
    domain TEXT,                               -- Si es por dominio
    proposal_id UUID REFERENCES proposals(id), -- Si es por propuesta
    
    -- Vigencia
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,                   -- NULL = sin expiración
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    
    CONSTRAINT no_self_delegation CHECK (delegator_id != delegate_id)
);

CREATE INDEX idx_delegations_delegator ON delegations(delegator_id, is_active);
CREATE INDEX idx_delegations_delegate ON delegations(delegate_id, is_active);
-- Delegaciones activas para una propuesta específica (resolución de voto delegado)
CREATE INDEX idx_delegations_proposal ON delegations(proposal_id, is_active)
    WHERE proposal_id IS NOT NULL;
-- Delegaciones por dominio temático (movilidad, salud, etc.)
CREATE INDEX idx_delegations_domain ON delegations(domain, is_active)
    WHERE domain IS NOT NULL;

-- ── Sesiones de autenticación (refresh tokens) ───────────────────────────────
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE NOT NULL,
    refresh_token_hash TEXT UNIQUE NOT NULL,    -- HMAC-SHA256 del token, nunca el token en claro
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address TEXT
);

CREATE INDEX idx_sessions_citizen_id ON sessions(citizen_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
-- Lookup de sesión válida: el path más frecuente en cada request autenticado
CREATE INDEX idx_sessions_active ON sessions(citizen_id, expires_at)
    WHERE revoked_at IS NULL;

-- ── Función para actualizar updated_at automáticamente ────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER territorial_reports_updated_at
    BEFORE UPDATE ON territorial_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Vistas útiles ─────────────────────────────────────────────────────────────

-- Vista: reportes activos con datos de localidad
CREATE VIEW active_reports_view AS
SELECT 
    r.*,
    l.name as locality_name,
    ST_X(r.location::geometry) as longitude,
    ST_Y(r.location::geometry) as latitude
FROM territorial_reports r
LEFT JOIN localities l ON r.locality_id = l.id
WHERE r.status IN ('open', 'in_progress');

-- Vista: resumen de participación por ciudadano
CREATE VIEW citizen_participation_summary AS
SELECT 
    c.id,
    c.did,
    c.locality_id,
    c.reputation_score,
    c.verification_level,
    COUNT(DISTINCT r.id) as reports_made,
    COUNT(DISTINCT p.id) as proposals_made,
    c.created_at,
    c.last_active_at
FROM citizens c
LEFT JOIN territorial_reports r ON r.citizen_id = c.id
LEFT JOIN proposals p ON p.author_id = c.id
GROUP BY c.id;

-- ── Módulo 06 — Reputación ────────────────────────────────────────────────────
-- Historial de eventos que generan o reducen reputación.
-- El score se computa como SUM(points); Neo4j mantiene el grafo de relaciones.

CREATE TABLE reputation_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id   UUID        NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    event_type   VARCHAR(50) NOT NULL,
    points       INTEGER     NOT NULL,
    reference_id VARCHAR(36),          -- ID del objeto relacionado (proposal, report, etc.)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_event_type CHECK (event_type IN (
        'vote_cast', 'proposal_created', 'proposal_approved', 'proposal_rejected',
        'report_submitted', 'report_resolved', 'endorsement_given', 'badge_earned',
        'delegation_given', 'delegation_received'
    ))
);

CREATE INDEX idx_reputation_citizen ON reputation_events(citizen_id, created_at DESC);
CREATE INDEX idx_reputation_event_type ON reputation_events(citizen_id, event_type);
CREATE INDEX idx_reputation_leaderboard ON reputation_events(citizen_id) INCLUDE (points);

-- ── Módulo Legal ──────────────────────────────────────────────────────────────
-- Documentos legales generados por IA a partir de reportes ciudadanos.
-- Soporta: derecho de petición, tutela, acción popular, denuncia, queja.

CREATE TABLE legal_documents (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id              UUID        NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,

    legal_type              VARCHAR(40) NOT NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    urgency                 VARCHAR(10) NOT NULL DEFAULT 'media',

    situation_description   TEXT        NOT NULL,
    evidence_description    TEXT,
    location                VARCHAR(300),
    evidence_urls           JSONB       NOT NULL DEFAULT '[]',

    rights_affected         JSONB       NOT NULL DEFAULT '[]',
    target_entity           JSONB,
    response_deadline_days  INTEGER     NOT NULL DEFAULT 15,
    legal_basis             JSONB       NOT NULL DEFAULT '[]',
    alternative_remedies    JSONB       NOT NULL DEFAULT '[]',
    next_steps              JSONB       NOT NULL DEFAULT '[]',
    legal_orientation       TEXT        NOT NULL DEFAULT '',
    ai_audit_id             VARCHAR(36),

    document_draft          TEXT        NOT NULL DEFAULT '',

    submitted_at            TIMESTAMPTZ,
    submitted_via           VARCHAR(10),
    entity_response         TEXT,
    entity_responded_at     TIMESTAMPTZ,
    response_deadline_at    TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_legal_type CHECK (legal_type IN (
        'derecho_de_peticion', 'tutela', 'accion_popular',
        'accion_de_cumplimiento', 'denuncia_penal', 'queja'
    )),
    CONSTRAINT valid_status CHECK (status IN (
        'draft', 'ready', 'submitted', 'responded', 'escalated', 'closed'
    )),
    CONSTRAINT valid_urgency CHECK (urgency IN ('baja', 'media', 'alta', 'critica'))
);

CREATE INDEX idx_legal_citizen ON legal_documents(citizen_id, created_at DESC);
CREATE INDEX idx_legal_status  ON legal_documents(citizen_id, status);
CREATE INDEX idx_legal_type    ON legal_documents(legal_type, status);
CREATE INDEX idx_legal_urgent  ON legal_documents(urgency, status)
    WHERE status IN ('draft', 'ready', 'submitted');

CREATE TRIGGER legal_documents_updated_at
    BEFORE UPDATE ON legal_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- Seed data mínimo para desarrollo
-- ═══════════════════════════════════════════════════════════════════

-- Ciudadano de prueba (en producción esto NO existe)
INSERT INTO citizens (did, cedula_hash, locality_id, neighborhood, display_name, verification_level, reputation_score)
VALUES (
    'did:polygon:0x1234567890abcdef',
    encode(digest('1234567890', 'sha256'), 'hex'),
    1,
    'Getsemaní',
    'Ciudadano Demo',
    2,
    0.75
) ON CONFLICT DO NOTHING;

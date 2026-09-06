-- Civic Actions Core v1
--
-- A civic action is the primary unit of social/community management in VÉRTICE.
-- It is intentionally distinct from a generic post and can coexist with legacy
-- territorial reports and proposals while the product migrates toward an
-- evidence-first civic network.

CREATE TABLE IF NOT EXISTS civic_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  problem TEXT NOT NULL,
  objective TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  neighborhood VARCHAR(120),
  locality_id INTEGER REFERENCES localities(id) ON DELETE SET NULL,
  beneficiaries_estimate INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'proposed',
  result_summary TEXT,
  target_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT civic_actions_status_check CHECK (
    status IN (
      'proposed',
      'preparing',
      'in_progress',
      'result_declared',
      'under_verification',
      'verified',
      'not_completed',
      'no_evidence',
      'disputed',
      'cancelled'
    )
  ),
  CONSTRAINT civic_actions_beneficiaries_check CHECK (
    beneficiaries_estimate IS NULL OR beneficiaries_estimate >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_civic_actions_actor
  ON civic_actions (actor_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_actions_territory
  ON civic_actions (neighborhood, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_civic_actions_public_feed
  ON civic_actions (status, updated_at DESC)
  WHERE status <> 'cancelled';

-- Evidence is append-only from the product surface. A SHA-256 content hash is
-- optional because not every client can calculate one yet, but when present it
-- is globally unique so the same evidence cannot be recycled across actions.
CREATE TABLE IF NOT EXISTS civic_action_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES civic_actions(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  evidence_type VARCHAR(30) NOT NULL,
  evidence_url TEXT NOT NULL,
  description VARCHAR(600),
  source_url TEXT,
  content_hash CHAR(64),
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT civic_action_evidence_type_check CHECK (
    evidence_type IN ('photo', 'video', 'document', 'location', 'external_record')
  ),
  CONSTRAINT civic_action_evidence_review_check CHECK (
    review_status IN ('pending', 'accepted', 'disputed', 'rejected')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS civic_action_evidence_content_hash_key
  ON civic_action_evidence (content_hash)
  WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_civic_action_evidence_action
  ON civic_action_evidence (action_id, created_at DESC);

CREATE TABLE IF NOT EXISTS civic_action_collaborators (
  action_id UUID NOT NULL REFERENCES civic_actions(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  collaboration_role VARCHAR(80) NOT NULL DEFAULT 'collaborator',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (action_id, citizen_id)
);

CREATE INDEX IF NOT EXISTS idx_civic_action_collaborators_citizen
  ON civic_action_collaborators (citizen_id, joined_at DESC);

-- One citizen can emit one current stance per action. The service rejects
-- self-validation and the route requires verified identity. This gives the
-- score a bounded community signal without turning likes/followers into rank.
CREATE TABLE IF NOT EXISTS civic_action_validations (
  action_id UUID NOT NULL REFERENCES civic_actions(id) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  stance VARCHAR(20) NOT NULL,
  note VARCHAR(280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (action_id, citizen_id),
  CONSTRAINT civic_action_validations_stance_check CHECK (
    stance IN ('corroborate', 'dispute')
  )
);

CREATE INDEX IF NOT EXISTS idx_civic_action_validations_action
  ON civic_action_validations (action_id, updated_at DESC);

-- Verification is an auditable moderation decision. Action owners can declare
-- results, but only a live moderator/admin role can move an action into the
-- verification states through the review endpoint.
CREATE TABLE IF NOT EXISTS civic_action_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES civic_actions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
  decision VARCHAR(30) NOT NULL,
  note VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT civic_action_reviews_decision_check CHECK (
    decision IN ('under_verification', 'verified', 'disputed', 'no_evidence')
  )
);

CREATE INDEX IF NOT EXISTS idx_civic_action_reviews_action
  ON civic_action_reviews (action_id, created_at DESC);

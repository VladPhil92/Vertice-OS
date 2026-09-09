-- Phase 7B — National Launch & City Activation Operations
-- Operational rollout metadata is deliberately separate from civic authority.
-- No row in these tables grants authentication roles, identity assurance,
-- territory assurance, reputation, voting eligibility or vote weight.

CREATE TABLE IF NOT EXISTS territory_launch_plans (
  territory_code TEXT PRIMARY KEY REFERENCES territories(code) ON DELETE CASCADE,
  operational_state VARCHAR(24) NOT NULL DEFAULT 'observing',
  target_active_citizens INTEGER NOT NULL DEFAULT 10,
  target_verified_actions INTEGER NOT NULL DEFAULT 3,
  target_local_leaders INTEGER NOT NULL DEFAULT 2,
  target_moderators INTEGER NOT NULL DEFAULT 1,
  launch_window_start DATE,
  launch_window_end DATE,
  notes TEXT,
  updated_by UUID REFERENCES citizens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT territory_launch_state_check CHECK (
    operational_state IN ('observing','recruiting','launch_ready','launched','paused')
  ),
  CONSTRAINT territory_launch_targets_positive CHECK (
    target_active_citizens >= 0 AND target_verified_actions >= 0
    AND target_local_leaders >= 0 AND target_moderators >= 0
  ),
  CONSTRAINT territory_launch_window_check CHECK (
    launch_window_start IS NULL OR launch_window_end IS NULL OR launch_window_end >= launch_window_start
  )
);

CREATE INDEX IF NOT EXISTS idx_territory_launch_plans_state
  ON territory_launch_plans (operational_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS territory_launch_cohort_members (
  territory_code TEXT NOT NULL REFERENCES territories(code) ON DELETE CASCADE,
  citizen_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  cohort_role VARCHAR(24) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  assigned_by UUID REFERENCES citizens(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  notes VARCHAR(500),
  PRIMARY KEY (territory_code, citizen_id, cohort_role),
  CONSTRAINT territory_launch_cohort_role_check CHECK (
    cohort_role IN ('ambassador','organizer','observer')
  ),
  CONSTRAINT territory_launch_cohort_status_check CHECK (
    status IN ('active','inactive')
  )
);

CREATE INDEX IF NOT EXISTS idx_territory_launch_cohort_active
  ON territory_launch_cohort_members (territory_code, status, assigned_at DESC);

-- Immutable operational transition ledger. Authorization still comes only from
-- live role grants/sessions; this ledger provides rollout traceability.
CREATE TABLE IF NOT EXISTS territory_launch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_code TEXT NOT NULL REFERENCES territories(code) ON DELETE CASCADE,
  actor_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  previous_state VARCHAR(24),
  next_state VARCHAR(24),
  reason VARCHAR(1000) NOT NULL,
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_territory_launch_events_timeline
  ON territory_launch_events (territory_code, created_at DESC);

-- Cartagena starts as the first launch plan because it is the current pilot.
INSERT INTO territory_launch_plans (
  territory_code, operational_state, target_active_citizens,
  target_verified_actions, target_local_leaders, target_moderators, notes
)
SELECT 'CO-MP-13001', 'launch_ready', 10, 3, 2, 1,
       'Bootstrap from Phase 6 Cartagena pilot / Phase 7A pilot_ready node.'
WHERE EXISTS (SELECT 1 FROM territories WHERE code = 'CO-MP-13001')
ON CONFLICT (territory_code) DO NOTHING;

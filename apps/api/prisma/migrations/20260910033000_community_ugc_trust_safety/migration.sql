-- Phase 8C — durable User-Generated Content trust & safety controls.
-- These tables are intentionally separate from civic reputation/governance:
-- reporting, blocking or moderation must never grant civic score or authority.

CREATE TABLE IF NOT EXISTS community_policy_acceptances (
    citizen_id UUID PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
    policy_version TEXT NOT NULL,
    accepted_source TEXT NOT NULL DEFAULT 'app'
        CHECK (accepted_source IN ('app', 'web', 'admin_import')),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_user_blocks (
    blocker_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT community_user_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_community_user_blocks_blocked
    ON community_user_blocks(blocked_id, blocker_id);

CREATE TABLE IF NOT EXISTS community_safety_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL
        CHECK (target_type IN ('profile', 'report', 'proposal', 'publication')),
    target_id UUID NOT NULL,
    target_owner_id UUID REFERENCES citizens(id) ON DELETE SET NULL,
    reason TEXT NOT NULL
        CHECK (reason IN ('harassment', 'hate', 'sexual_content', 'violence', 'spam', 'impersonation', 'privacy', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'reviewing', 'actioned', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES citizens(id) ON DELETE SET NULL,
    resolution_action TEXT
        CHECK (resolution_action IS NULL OR resolution_action IN ('none', 'hide_target')),
    resolution_note TEXT,
    UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_community_safety_reports_queue
    ON community_safety_reports(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_safety_reports_target
    ON community_safety_reports(target_type, target_id, status);

CREATE TABLE IF NOT EXISTS community_moderation_visibility (
    target_type TEXT NOT NULL
        CHECK (target_type IN ('profile', 'report', 'proposal', 'publication')),
    target_id UUID NOT NULL,
    hidden_by UUID NOT NULL REFERENCES citizens(id) ON DELETE RESTRICT,
    source_report_id UUID REFERENCES community_safety_reports(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_community_moderation_visibility_actor
    ON community_moderation_visibility(target_type, target_id);

COMMENT ON TABLE community_policy_acceptances IS 'Versioned acceptance ledger for Community Guidelines / UGC user policy.';
COMMENT ON TABLE community_user_blocks IS 'User-controlled safety blocks; excluded from civic reputation and authority.';
COMMENT ON TABLE community_safety_reports IS 'UGC/profile abuse reports with auditable moderation lifecycle.';
COMMENT ON TABLE community_moderation_visibility IS 'Visibility overlay for moderator-hidden UGC/profile targets without rewriting civic lifecycle history.';

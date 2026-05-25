-- VÉRTICE OS — Add role field to citizens + admin proposal fields
-- Roles: citizen (default) | moderator | admin

ALTER TABLE "citizens" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'citizen';

-- Extend proposals with admin moderation fields
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

ALTER TABLE "proposals" DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE "proposals" ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('idea', 'draft', 'debate', 'voting', 'approved',
                    'rejected', 'executed', 'failed_execution', 'quorum_failed', 'archived'));

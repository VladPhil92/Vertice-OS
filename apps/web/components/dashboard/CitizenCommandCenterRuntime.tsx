'use client'

import CitizenCommandCenter from '@/components/dashboard/CitizenCommandCenter'
import { useDashboardRuntime } from '@/components/dashboard/DashboardIdentityProvider'

/**
 * Transitional Phase 4 boundary.
 *
 * CitizenCommandCenter predates the shared runtime and remains intentionally
 * untouched until the Phase 5 Command Center v2 redesign. Its /dashboard/me
 * read is nevertheless coalesced by apiFetch, and this key guarantees the
 * legacy local view remounts when the canonical runtime snapshot changes.
 */
export default function CitizenCommandCenterRuntime() {
  const { dashboard } = useDashboardRuntime()
  const snapshotKey = dashboard?.generated_at ?? 'dashboard-runtime-loading'

  return <CitizenCommandCenter key={snapshotKey} />
}

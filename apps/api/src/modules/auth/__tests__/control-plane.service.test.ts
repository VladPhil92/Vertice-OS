const mockQueryRaw = jest.fn()

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}))

import {
  getSuperadminControlPlaneOverview,
  listSuperadminAuditEvents,
} from '../control-plane.service'

beforeEach(() => {
  jest.resetAllMocks()
})

describe('superadmin control plane service', () => {
  it('maps authority and operational counters without exposing mutation capabilities', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      citizens_total: 125n,
      active_citizens: 118n,
      verified_citizens: 71n,
      moderators: 4n,
      admins: 2n,
      superadmins: 1n,
      privileged_sessions: 3n,
      reports_open: 12n,
      reports_in_progress: 8n,
      proposals_active: 9n,
      proposals_voting: 2n,
      audit_24h: 17n,
    }])

    const result = await getSuperadminControlPlaneOverview()

    expect(result.authority).toEqual({
      citizens_total: 125,
      active_citizens: 118,
      verified_citizens: 71,
      moderators: 4,
      admins: 2,
      superadmins: 1,
      privileged_sessions: 3,
    })
    expect(result.operations).toEqual({
      reports_open: 12,
      reports_in_progress: 8,
      proposals_active: 9,
      proposals_voting: 2,
      audit_events_24h: 17,
    })
    expect(result.guardrails).toEqual({
      last_superadmin_protected: true,
      audit_log_append_only: true,
      vote_mutation_exposed: false,
      manual_identity_override_exposed: false,
    })
    expect(Date.parse(result.generated_at)).not.toBeNaN()
  })

  it('fails closed when the summary query returns no state', async () => {
    mockQueryRaw.mockResolvedValueOnce([])

    await expect(getSuperadminControlPlaneOverview()).rejects.toMatchObject({
      statusCode: 503,
      code: 'CONTROL_PLANE_OVERVIEW_UNAVAILABLE',
    })
  })

  it('returns append-only audit events with actor and target context', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      id: 'audit-id',
      actor_id: 'actor-id',
      actor_name: 'Operador Vértice',
      actor_email: 'operator@example.com',
      action: 'role.replace_grants',
      target_type: 'citizen',
      target_id: 'target-id',
      result: 'success',
      reason: null,
      metadata: { before: ['citizen'], after: ['citizen', 'admin'] },
      created_at: new Date('2026-09-07T17:00:00.000Z'),
    }])

    const events = await listSuperadminAuditEvents(30)

    expect(events).toEqual([{
      id: 'audit-id',
      actor: {
        citizen_id: 'actor-id',
        display_name: 'Operador Vértice',
        email: 'operator@example.com',
      },
      action: 'role.replace_grants',
      target: {
        type: 'citizen',
        id: 'target-id',
      },
      result: 'success',
      reason: null,
      metadata: { before: ['citizen'], after: ['citizen', 'admin'] },
      created_at: '2026-09-07T17:00:00.000Z',
    }])
  })
})

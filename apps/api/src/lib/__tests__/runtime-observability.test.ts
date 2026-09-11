import {
  assessOperationalHealth,
  createDependencyTransitionTracker,
  type DependencyTransition,
  type RuntimeDependencyDetails,
} from '../runtime-observability'

describe('runtime observability', () => {
  const healthyDetails: RuntimeDependencyDetails = {
    redis: { state: 'ok', latency_ms: 3 },
    database: { state: 'ok', latency_ms: 8 },
    neo4j: { state: 'ok', latency_ms: 11 },
  }

  it('emits initial dependency states once and suppresses identical probe noise', () => {
    const events: DependencyTransition[] = []
    const tracker = createDependencyTransitionTracker('abc123', (event) => events.push(event))

    tracker.observe(healthyDetails)
    tracker.observe({
      redis: { state: 'ok', latency_ms: 4 },
      database: { state: 'ok', latency_ms: 9 },
      neo4j: { state: 'ok', latency_ms: 12 },
    })

    expect(events).toHaveLength(3)
    expect(events.every((event) => event.previous_state === 'unknown')).toBe(true)
    expect(events.every((event) => event.revision === 'abc123')).toBe(true)
  })

  it('emits degradation and recovery exactly on state transitions', () => {
    const events: DependencyTransition[] = []
    const tracker = createDependencyTransitionTracker('release-sha', (event) => events.push(event))

    tracker.observe(healthyDetails)
    tracker.observe({ ...healthyDetails, neo4j: { state: 'fail', latency_ms: 22, failure_code: 'unavailable' } })
    tracker.observe({ ...healthyDetails, neo4j: { state: 'fail', latency_ms: 18, failure_code: 'unavailable' } })
    tracker.observe(healthyDetails)

    const neo4jEvents = events.filter((event) => event.dependency === 'neo4j')
    expect(neo4jEvents.map((event) => [event.previous_state, event.current_state])).toEqual([
      ['unknown', 'ok'],
      ['ok', 'fail'],
      ['fail', 'ok'],
    ])
  })

  it('keeps optional dependency failure out of serving readiness but blocks strict operations', () => {
    const result = assessOperationalHealth(
      { redis: 'ok', database: 'ok', neo4j: 'fail' },
      true,
      [],
    )

    expect(result).toEqual({
      operational: false,
      status: 'degraded',
      blockers: ['dependency:neo4j'],
    })
  })

  it('reports unavailable when a core serving dependency fails', () => {
    const result = assessOperationalHealth(
      { redis: 'fail', database: 'ok', neo4j: 'ok' },
      false,
      ['dependency:redis'],
    )

    expect(result.operational).toBe(false)
    expect(result.status).toBe('unavailable')
    expect(result.blockers).toEqual(['dependency:redis'])
  })
})

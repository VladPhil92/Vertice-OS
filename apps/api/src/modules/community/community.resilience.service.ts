import type { CommunityFeedQuery } from './community.schema'
import { listCommunityFeed, type CivicActivity } from './community.service'

type SourceState = 'available' | 'unavailable' | 'not_requested'

export interface CommunityFeedAvailability {
  reports: SourceState
  proposals: SourceState
  degraded: boolean
}

export interface ResilientCommunityFeed {
  data: CivicActivity[]
  availability: CommunityFeedAvailability
}

function sortAndLimit(items: CivicActivity[], limit: number): CivicActivity[] {
  return items
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit)
}

function unavailableFor(type: 'report' | 'proposal'): CommunityFeedAvailability {
  return type === 'report'
    ? { reports: 'unavailable', proposals: 'not_requested', degraded: true }
    : { reports: 'not_requested', proposals: 'unavailable', degraded: true }
}

/**
 * Keeps the public civic network useful when one read domain is temporarily
 * unavailable. A partial result is explicitly labelled as degraded; it is
 * never presented as a complete feed and it never changes civic scoring.
 */
export async function listCommunityFeedResilient(input: CommunityFeedQuery): Promise<ResilientCommunityFeed> {
  try {
    const data = await listCommunityFeed(input)
    return {
      data,
      availability: {
        reports: input.type === 'proposal' ? 'not_requested' : 'available',
        proposals: input.type === 'report' ? 'not_requested' : 'available',
        degraded: false,
      },
    }
  } catch (primaryError) {
    if (input.type === 'report' || input.type === 'proposal') {
      return { data: [], availability: unavailableFor(input.type) }
    }

    const [reports, proposals] = await Promise.allSettled([
      listCommunityFeed({ ...input, type: 'report' }),
      listCommunityFeed({ ...input, type: 'proposal' }),
    ])

    if (reports.status === 'rejected' && proposals.status === 'rejected') {
      throw primaryError
    }

    const reportData = reports.status === 'fulfilled' ? reports.value : []
    const proposalData = proposals.status === 'fulfilled' ? proposals.value : []

    return {
      data: sortAndLimit([...reportData, ...proposalData], input.limit),
      availability: {
        reports: reports.status === 'fulfilled' ? 'available' : 'unavailable',
        proposals: proposals.status === 'fulfilled' ? 'available' : 'unavailable',
        degraded: true,
      },
    }
  }
}

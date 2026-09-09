import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { getTerritory } from './territories.service'

export async function getTerritoryFeed(territoryCode: string, limit = 12) {
  const territory = await getTerritory(territoryCode)
  if (!['municipality', 'district'].includes(territory.level)) {
    throw Object.assign(new Error('El feed territorial opera a nivel municipal/distrital'), {
      statusCode: 400,
      code: 'TERRITORY_FEED_LEVEL_UNSUPPORTED',
    })
  }
  const bounded = Math.max(1, Math.min(limit, 30))

  const [actions, reports, proposals] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string; title: string; category: string; neighborhood: string | null
      status: string; created_at: Date; updated_at: Date
    }>>(Prisma.sql`
      SELECT id::text, title, category, neighborhood, status, created_at, updated_at
      FROM civic_actions
      WHERE territory_code = ${territoryCode} AND status <> 'cancelled'
      ORDER BY updated_at DESC LIMIT ${bounded}
    `),
    prisma.$queryRaw<Array<{
      id: string; title: string; category: string; neighborhood: string | null
      status: string; created_at: Date
    }>>(Prisma.sql`
      SELECT id::text, title, category, neighborhood, status, created_at
      FROM territorial_reports
      WHERE territory_code = ${territoryCode} AND status NOT IN ('rejected','duplicate')
      ORDER BY created_at DESC LIMIT ${bounded}
    `),
    prisma.$queryRaw<Array<{
      id: string; title: string; category: string; scope: string
      status: string; created_at: Date
    }>>(Prisma.sql`
      SELECT id::text, title, category, scope, status, created_at
      FROM proposals
      WHERE territory_code = ${territoryCode} AND status <> 'archived'
      ORDER BY created_at DESC LIMIT ${bounded}
    `),
  ])

  return {
    territory,
    actions,
    reports,
    proposals,
    empty_state: actions.length + reports.length + proposals.length === 0
      ? 'Sé una de las primeras personas en activar esta comunidad en VÉRTICE.'
      : null,
  }
}

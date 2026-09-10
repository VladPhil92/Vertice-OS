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
  const department = territory.parent_code
    ? await getTerritory(territory.parent_code).catch(() => null)
    : null
  const canonicalGeography = {
    territory_code: territory.code,
    territory_name: territory.name,
    department_code: department?.level === 'department' ? department.code : null,
    department_name: department?.level === 'department' ? department.name : null,
  }

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
    territory: {
      ...territory,
      department_code: canonicalGeography.department_code,
      department_name: canonicalGeography.department_name,
    },
    actions: actions.map((item) => ({ ...item, ...canonicalGeography })),
    reports: reports.map((item) => ({ ...item, ...canonicalGeography })),
    proposals: proposals.map((item) => ({ ...item, ...canonicalGeography })),
    empty_state: actions.length + reports.length + proposals.length === 0
      ? 'Sé una de las primeras personas en activar esta comunidad en VÉRTICE.'
      : null,
  }
}

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { assertColombianMunicipalTerritory } from '../territories/territory-context.service'
import type { CreateCivicActionInput } from './civic-actions.schema'
import { getCivicAction } from './civic-actions.service'

/**
 * Creates the civic action and its owner membership in one PostgreSQL
 * transaction. An action must never become visible without its owner
 * collaborator row, even if the process terminates between statements.
 */
export async function createCivicActionAtomically(
  citizenId: string,
  input: CreateCivicActionInput,
) {
  if (input.territory_source && !input.territory_code) {
    throw Object.assign(new Error('El origen territorial requiere un territorio objetivo explícito.'), {
      statusCode: 400,
      code: 'CIVIC_ACTION_TERRITORY_REQUIRED_FOR_SOURCE',
    })
  }
  if (input.territory_code) {
    await assertColombianMunicipalTerritory(input.territory_code)
  }

  const actionId = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO civic_actions (
        actor_id,
        title,
        problem,
        objective,
        category,
        neighborhood,
        locality_id,
        territory_code,
        territory_source,
        beneficiaries_estimate,
        target_date
      ) VALUES (
        ${citizenId}::uuid,
        ${input.title},
        ${input.problem},
        ${input.objective},
        ${input.category},
        ${input.neighborhood ?? null},
        ${input.locality_id ?? null},
        ${input.territory_code ?? null},
        ${input.territory_code ? (input.territory_source ?? 'manual') : null},
        ${input.beneficiaries_estimate ?? null},
        ${input.target_date ?? null}::date
      )
      RETURNING id::text
    `)

    const id = rows[0]?.id
    if (!id) {
      throw Object.assign(new Error('No fue posible crear la acción cívica'), {
        statusCode: 500,
        code: 'CIVIC_ACTION_CREATE_FAILED',
      })
    }

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO civic_action_collaborators (
        action_id,
        citizen_id,
        collaboration_role
      ) VALUES (
        ${id}::uuid,
        ${citizenId}::uuid,
        'owner'
      )
      ON CONFLICT (action_id, citizen_id) DO UPDATE
      SET collaboration_role = 'owner'
    `)

    return id
  })

  return getCivicAction(actionId, citizenId)
}

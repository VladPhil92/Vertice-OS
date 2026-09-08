import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { releaseUsage, reserveUsage } from '../billing/billing.usage.service'
import type { ScheduleCivicPublicationInput } from './publishing.schema'

export interface ScheduledCivicPublication {
  id: string
  title: string
  body: string
  neighborhood: string | null
  status: 'scheduled' | 'published' | 'cancelled' | 'failed'
  scheduled_for: string
  published_at: string | null
  created_at: string
}

type PublicationRow = {
  id: string
  title: string
  body: string
  neighborhood: string | null
  status: ScheduledCivicPublication['status']
  scheduled_for: Date
  published_at: Date | null
  created_at: Date
}

function serialize(row: PublicationRow): ScheduledCivicPublication {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    neighborhood: row.neighborhood,
    status: row.status,
    scheduled_for: row.scheduled_for.toISOString(),
    published_at: row.published_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  }
}

async function requirePublishedCivicProfile(citizenId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ public_civic_profile: boolean }>>(Prisma.sql`
    SELECT public_civic_profile
    FROM citizens
    WHERE id = ${citizenId}::uuid AND is_active = TRUE
    LIMIT 1
  `)
  if (!rows[0]) {
    throw Object.assign(new Error('Perfil cívico no encontrado.'), {
      statusCode: 404,
      code: 'CIVIC_PROFILE_NOT_FOUND',
    })
  }
  if (!rows[0].public_civic_profile) {
    throw Object.assign(new Error('Publica tu perfil cívico antes de programar contenido.'), {
      statusCode: 409,
      code: 'PUBLIC_CIVIC_PROFILE_REQUIRED',
    })
  }
}

export async function listMyScheduledPublications(citizenId: string): Promise<ScheduledCivicPublication[]> {
  const rows = await prisma.$queryRaw<PublicationRow[]>(Prisma.sql`
    SELECT id::text, title, body, neighborhood, status, scheduled_for, published_at, created_at
    FROM scheduled_civic_publications
    WHERE citizen_id = ${citizenId}::uuid
    ORDER BY scheduled_for DESC
    LIMIT 100
  `)
  return rows.map(serialize)
}

export async function scheduleCivicPublication(
  citizenId: string,
  input: ScheduleCivicPublicationInput,
): Promise<ScheduledCivicPublication> {
  await requirePublishedCivicProfile(citizenId)
  await reserveUsage(citizenId, 'scheduled_posts', 1)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<PublicationRow[]>(Prisma.sql`
        INSERT INTO scheduled_civic_publications (
          citizen_id, title, body, neighborhood, scheduled_for
        ) VALUES (
          ${citizenId}::uuid,
          ${input.title},
          ${input.body},
          ${input.neighborhood ?? null},
          ${new Date(input.scheduled_for)}
        )
        RETURNING id::text, title, body, neighborhood, status, scheduled_for, published_at, created_at
      `)
      const publication = rows[0]
      if (!publication) throw new Error('PUBLICATION_INSERT_FAILED')

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO jobs (type, payload, run_after)
        VALUES (
          'publish_civic_update',
          ${JSON.stringify({ publicationId: publication.id })}::jsonb,
          ${publication.scheduled_for}
        )
      `)
      return publication
    })

    return serialize(result)
  } catch (error) {
    await releaseUsage(citizenId, 'scheduled_posts', 1).catch(() => undefined)
    throw error
  }
}

export async function cancelScheduledPublication(
  citizenId: string,
  publicationId: string,
): Promise<ScheduledCivicPublication> {
  const rows = await prisma.$queryRaw<PublicationRow[]>(Prisma.sql`
    UPDATE scheduled_civic_publications
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${publicationId}::uuid
      AND citizen_id = ${citizenId}::uuid
      AND status = 'scheduled'
    RETURNING id::text, title, body, neighborhood, status, scheduled_for, published_at, created_at
  `)
  if (!rows[0]) {
    throw Object.assign(new Error('La publicación no existe o ya no puede cancelarse.'), {
      statusCode: 409,
      code: 'PUBLICATION_NOT_CANCELLABLE',
    })
  }
  return serialize(rows[0])
}

export async function publishScheduledCivicPublication(publicationId: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE scheduled_civic_publications
    SET status = 'published', published_at = NOW(), updated_at = NOW()
    WHERE id = ${publicationId}::uuid
      AND status = 'scheduled'
      AND scheduled_for <= NOW()
  `)
}

import { z } from 'zod'

export const ScheduleCivicPublicationSchema = z.object({
  title: z.string().trim().min(5).max(160),
  body: z.string().trim().min(20).max(5000),
  neighborhood: z.string().trim().min(2).max(120).nullable().optional(),
  scheduled_for: z.string().datetime({ offset: true }),
}).superRefine((value, ctx) => {
  const scheduled = new Date(value.scheduled_for).getTime()
  if (!Number.isFinite(scheduled) || scheduled < Date.now() + 60_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduled_for'],
      message: 'La publicación debe programarse al menos un minuto hacia el futuro.',
    })
  }
})

export const PublicationParamsSchema = z.object({
  publicationId: z.string().uuid(),
})

export type ScheduleCivicPublicationInput = z.infer<typeof ScheduleCivicPublicationSchema>

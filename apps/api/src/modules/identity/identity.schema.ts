import { z } from 'zod'

export const ConfirmCedulaSchema = z.object({
  cedula: z
    .string()
    .min(6)
    .max(10)
    .regex(/^\d+$/, 'Cédula debe ser solo dígitos'),
})

export const ConfirmEmailTokenSchema = z.object({
  token: z.string().length(64, 'Token debe tener 64 caracteres'),
})

export const UpdateProfileSchema = z.object({
  neighborhood: z.string().min(1).max(120).optional(),
  locality_id: z.number().int().positive().optional(),
}).refine(
  (d) => d.neighborhood !== undefined || d.locality_id !== undefined,
  { message: 'Debe proveer al menos un campo para actualizar' }
)

export type ConfirmCedulaInput = z.infer<typeof ConfirmCedulaSchema>
export type ConfirmEmailTokenInput = z.infer<typeof ConfirmEmailTokenSchema>
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>

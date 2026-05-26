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

export const ConnectWalletSchema = z.object({
  wallet_address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Dirección de wallet inválida — debe ser una dirección Ethereum válida'),
})

export type ConfirmCedulaInput      = z.infer<typeof ConfirmCedulaSchema>
export type ConfirmEmailTokenInput  = z.infer<typeof ConfirmEmailTokenSchema>
export type UpdateProfileInput      = z.infer<typeof UpdateProfileSchema>
export type ConnectWalletInput      = z.infer<typeof ConnectWalletSchema>

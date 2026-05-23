import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  cedula: z
    .string()
    .min(6)
    .max(10)
    .regex(/^\d+$/, 'Cédula debe ser solo dígitos'),
  neighborhood: z.string().max(120).optional(),
  locality_id: z.number().int().positive().optional(),
})

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

export const RefreshSchema = z.object({
  // refresh_token llega por cookie HttpOnly; este schema valida el body vacío
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>

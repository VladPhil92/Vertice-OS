import { z } from 'zod'

// Política única, reusada por registro, reset y cambio de contraseña — antes
// reset-password validaba a mano (solo longitud >= 8) sin las reglas de
// mayúscula/número de aquí, así que una contraseña más débil que la exigida
// al registrarse podía colarse por ese camino.
export const PasswordSchema = z
  .string()
  .min(8, 'Debe tener al menos 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')

export const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: PasswordSchema,
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

export const ForgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: PasswordSchema,
})

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: PasswordSchema,
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>

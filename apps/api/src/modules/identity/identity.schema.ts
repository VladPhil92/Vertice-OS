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
  // Firma del mensaje devuelto por POST /identity/wallet/nonce. Sin esto,
  // conectar una wallet solo comprobaba formato + unicidad: cualquiera podía
  // copiar la dirección pública de otra persona y registrarla como propia,
  // sin controlarla. La firma prueba control real de la clave privada.
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Firma inválida'),
})

// Contrato normalizado entre un adaptador de proveedor KYC y VÉRTICE.
// El adaptador es responsable de validar primero la firma nativa del proveedor;
// la API recibe únicamente referencias opacas y hashes, nunca biometría o PII cruda.
export const CivicProofingEventSchema = z.object({
  provider: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_.-]*$/i),
  event_id: z.string().min(1).max(191),
  citizen_id: z.string().uuid(),
  provider_reference: z.string().min(1).max(191),
  status: z.enum(['pending', 'review', 'verified', 'rejected', 'expired', 'revoked']),
  assurance_level: z.number().int().min(0).max(3),
  evidence_hash: z.string().regex(/^[0-9a-f]{64}$/i).transform((value) => value.toLowerCase()).nullable().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
})

export type ConfirmCedulaInput      = z.infer<typeof ConfirmCedulaSchema>
export type ConfirmEmailTokenInput  = z.infer<typeof ConfirmEmailTokenSchema>
export type UpdateProfileInput      = z.infer<typeof UpdateProfileSchema>
export type ConnectWalletInput      = z.infer<typeof ConnectWalletSchema>
export type CivicProofingEventInput = z.infer<typeof CivicProofingEventSchema>

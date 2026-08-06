import { z } from 'zod'

const INJECTION_PATTERNS = ['<|system|>', '<|user|>', '<|assistant|>', 'ignore previous']

function noInjection(val: string): boolean {
  const lower = val.toLowerCase()
  return !INJECTION_PATTERNS.some(p => lower.includes(p.toLowerCase()))
}

export const CivicQuerySchema = z.object({
  message: z
    .string()
    .min(3)
    .max(2000)
    .refine(noInjection, { message: 'Formato de mensaje no permitido' }),
  locality: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  topic: z.string().max(200).optional(),
  session_id: z.string().uuid().optional(),
  conversation_history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
})

export const TerritorialAnalysisSchema = z.object({
  report_ids: z.array(z.string().uuid()).min(1).max(50),
  locality: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
})

export const DebateSynthesisSchema = z.object({
  proposal_id: z.string().uuid(),
})

export const PolicyDraftSchema = z.object({
  citizen_demand: z
    .string()
    .min(10)
    .max(5000)
    .refine(noInjection, { message: 'Formato de mensaje no permitido' }),
  category: z.string().max(100),
  scope: z.enum(['neighborhood', 'locality', 'city', 'regional', 'national']),
  territory: z.string().max(120).optional(),
})

export const LegalAnalysisSchema = z.object({
  description: z
    .string()
    .min(30)
    .max(8000)
    .refine(noInjection, { message: 'Formato de descripción no permitido' }),
  evidence_description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  citizen_name: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
})

export type CivicQueryInput      = z.infer<typeof CivicQuerySchema>
export type TerritorialAnalysisInput = z.infer<typeof TerritorialAnalysisSchema>
export type DebateSynthesisInput  = z.infer<typeof DebateSynthesisSchema>
export type PolicyDraftInput      = z.infer<typeof PolicyDraftSchema>
export type LegalAnalysisInput    = z.infer<typeof LegalAnalysisSchema>

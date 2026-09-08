import { z } from 'zod'

export const brebKeyTypeSchema = z.enum([
  'ALPHANUMERIC',
  'MAIL',
  'PHONE',
  'IDENTIFICATION',
  'ESTABLISHMENT_CODE',
])

export type BrebKeyInput = {
  keyType: z.infer<typeof brebKeyTypeSchema>
  key: string
}

function validBrebKey(value: BrebKeyInput): boolean {
  const key = value.key.trim()
  switch (value.keyType) {
    case 'ALPHANUMERIC': return /^@[A-Za-z0-9]{5,20}$/.test(key)
    case 'MAIL': return z.string().email().safeParse(key).success
    case 'PHONE': return /^3\d{9}$/.test(key)
    case 'IDENTIFICATION': return /^[A-Za-z0-9]{1,18}$/.test(key)
    case 'ESTABLISHMENT_CODE': return /^\d{8}$/.test(key)
  }
}

export function addBrebKeyIssue(value: BrebKeyInput, ctx: z.RefinementCtx): void {
  if (!validBrebKey(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['key'],
      message: 'Formato de llave BRE-B inválido para el tipo seleccionado',
    })
  }
}

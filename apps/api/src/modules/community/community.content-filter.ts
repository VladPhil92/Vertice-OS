export interface CommunityTextField {
  field: string
  value: string | null | undefined
}

export interface CommunityContentScreeningResult {
  allowed: boolean
  reasons: string[]
}

const directThreatPatterns = [
  /\bte\s+voy\s+a\s+matar\b/i,
  /\bvoy\s+a\s+matarte\b/i,
  /\bte\s+matar[eé]\b/i,
  /\bi\s+(?:will|'ll|’ll)\s+kill\s+you\b/i,
  /\bi(?:'|’)ll\s+kill\s+you\b/i,
]

const pornPromotionPatterns = [
  /\b(?:pornhub|xvideos|xnxx)\.(?:com|net)\b/i,
  /\b(?:vendo|vender|compra|comprar|buy|selling)\s+(?:contenido\s+)?(?:porno(?:graf[ií]a)?|nudes?|packs?\s+sexuales?)\b/i,
]

function normalizedText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function screenCommunityContent(fields: CommunityTextField[]): CommunityContentScreeningResult {
  const reasons = new Set<string>()

  for (const item of fields) {
    if (!item.value) continue
    const text = normalizedText(item.value)
    if (!text) continue

    if (directThreatPatterns.some((pattern) => pattern.test(text))) {
      reasons.add(`${item.field}:direct_threat`)
    }
    if (pornPromotionPatterns.some((pattern) => pattern.test(text))) {
      reasons.add(`${item.field}:sexual_spam`)
    }

    const urls = text.match(/https?:\/\/[^\s]+/gi) ?? []
    if (urls.length > 8) reasons.add(`${item.field}:link_spam`)

    if (/(.)\1{24,}/u.test(text)) reasons.add(`${item.field}:repetitive_spam`)
  }

  return { allowed: reasons.size === 0, reasons: [...reasons] }
}

export function assertCommunityContentAllowed(fields: CommunityTextField[]): void {
  const result = screenCommunityContent(fields)
  if (result.allowed) return

  throw Object.assign(
    new Error('El contenido activa un filtro preventivo de seguridad y no puede publicarse en su forma actual.'),
    {
      statusCode: 422,
      code: 'UGC_CONTENT_BLOCKED',
      moderationReasons: result.reasons,
    },
  )
}

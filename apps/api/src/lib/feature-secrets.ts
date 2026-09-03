import { config } from '../config'

function unavailable(message: string, code: string): Error {
  return Object.assign(new Error(message), { statusCode: 503, code })
}

/**
 * High-impact feature secrets must never silently reuse JWT_SECRET in
 * production. Missing feature secrets degrade only the affected capability;
 * core API boot remains reserved for truly core dependencies (DB/Redis/JWT).
 */
export function getVoteNullifierSecret(): string {
  if (config.NODE_ENV === 'production' && !config.VOTE_NULLIFIER_SECRET) {
    throw unavailable(
      'La votación está temporalmente deshabilitada mientras se completa la configuración criptográfica',
      'VOTING_CRYPTO_UNAVAILABLE',
    )
  }
  return config.VOTE_NULLIFIER_SECRET ?? config.JWT_SECRET
}

export function getIdentityPepper(): string {
  if (config.NODE_ENV === 'production' && !config.IDENTITY_PEPPER) {
    throw unavailable(
      'La verificación de identidad está temporalmente deshabilitada mientras se completa la configuración criptográfica',
      'IDENTITY_CRYPTO_UNAVAILABLE',
    )
  }
  return config.IDENTITY_PEPPER ?? config.JWT_SECRET
}

export function getAIServiceSecret(): string | undefined {
  if (config.NODE_ENV === 'production' && !config.AI_SERVICE_SECRET) {
    throw unavailable(
      'El servicio de IA cívica está temporalmente no disponible por configuración incompleta',
      'AI_SERVICE_UNAVAILABLE',
    )
  }
  return config.AI_SERVICE_SECRET || undefined
}

export type GovernanceEligibilityReasonCode =
  | 'ELIGIBLE_CURRENT_ASSURANCE'
  | 'ELIGIBLE_FROZEN_ELECTORATE'
  | 'IDENTITY_ASSURANCE_UNAVAILABLE'
  | 'IDENTITY_ASSURANCE_REQUIRED'
  | 'TERRITORY_ASSURANCE_REQUIRED'
  | 'TERRITORY_ASSURANCE_EXPIRED'
  | 'TERRITORY_SCOPE_MISMATCH'
  | 'VOTER_ROLL_UNAVAILABLE'
  | 'NOT_IN_FROZEN_ELECTORATE'

export interface GovernanceEligibility {
  proposal_id: string
  citizen_id: string
  scope: string
  eligible: boolean
  authority: 'current_assurance' | 'frozen_electorate' | 'none'
  reason_code: GovernanceEligibilityReasonCode
  evaluated_at: string
  identity_assurance: {
    required: boolean
    satisfied: boolean
    proof_id: string | null
    provider: string | null
    verified_at: string | null
    expires_at: string | null
  }
  territory_assurance: {
    required: boolean
    satisfied: boolean
    expired?: boolean
    scope_match?: boolean
    request_id: string | null
    territory_code: string | null
    assurance_level: number | null
    verified_at: string | null
    expires_at: string | null
  }
  frozen_electorate: {
    required: boolean
    available: boolean
    member: boolean
    frozen_at: string | null
    provenance_available: boolean
  }
}

export type EligibilityRemediation = 'none' | 'identity' | 'residence' | 'territory' | 'support'

export interface EligibilityExperience {
  tone: 'positive' | 'warning' | 'blocked'
  title: string
  description: string
  remediation: EligibilityRemediation
  actionLabel: string | null
  actionHref: string | null
}

const EXPERIENCE: Record<GovernanceEligibilityReasonCode, EligibilityExperience> = {
  ELIGIBLE_CURRENT_ASSURANCE: {
    tone: 'positive',
    title: 'Elegibilidad verificada',
    description: 'Tu identidad y, cuando aplica, tu residencia territorial cumplen las condiciones actuales para esta propuesta.',
    remediation: 'none',
    actionLabel: null,
    actionHref: null,
  },
  ELIGIBLE_FROZEN_ELECTORATE: {
    tone: 'positive',
    title: 'Perteneces al padrón congelado',
    description: 'Tu elegibilidad fue fijada al abrir la votación. Los cambios posteriores de perfil no reescriben este padrón.',
    remediation: 'none',
    actionLabel: null,
    actionHref: null,
  },
  IDENTITY_ASSURANCE_UNAVAILABLE: {
    tone: 'blocked',
    title: 'Verificación de identidad temporalmente no disponible',
    description: 'La infraestructura de identity assurance requerida por gobernanza no está operativa. No existe un bypass desde el cliente.',
    remediation: 'support',
    actionLabel: null,
    actionHref: null,
  },
  IDENTITY_ASSURANCE_REQUIRED: {
    tone: 'warning',
    title: 'Debes verificar tu identidad cívica',
    description: 'Esta participación requiere una prueba de identidad vigente emitida por un proveedor autorizado.',
    remediation: 'identity',
    actionLabel: 'Verificar identidad',
    actionHref: '/dashboard/identity',
  },
  TERRITORY_ASSURANCE_REQUIRED: {
    tone: 'warning',
    title: 'Debes verificar tu residencia',
    description: 'Las votaciones subnacionales requieren residencia verificable en el territorio correspondiente. La ubicación GPS no sirve como prueba.',
    remediation: 'residence',
    actionLabel: 'Verificar residencia',
    actionHref: '/dashboard/territory',
  },
  TERRITORY_ASSURANCE_EXPIRED: {
    tone: 'warning',
    title: 'Tu verificación de residencia venció',
    description: 'Renueva la residencia antes de que se congele un nuevo padrón electoral. Una renovación no altera padrones ya abiertos.',
    remediation: 'residence',
    actionLabel: 'Renovar residencia',
    actionHref: '/dashboard/territory',
  },
  TERRITORY_SCOPE_MISMATCH: {
    tone: 'blocked',
    title: 'Esta votación pertenece a otro territorio',
    description: 'Tu residencia verificada no coincide con el ámbito territorial de esta propuesta. Cambiar el contexto de viaje no modifica la elegibilidad.',
    remediation: 'territory',
    actionLabel: 'Revisar territorio',
    actionHref: '/dashboard/territory',
  },
  VOTER_ROLL_UNAVAILABLE: {
    tone: 'blocked',
    title: 'Padrón electoral no disponible',
    description: 'La votación ya abrió, pero el padrón congelado no está disponible. Por seguridad, Vértice no acepta votos hasta resolver la integridad del padrón.',
    remediation: 'support',
    actionLabel: null,
    actionHref: null,
  },
  NOT_IN_FROZEN_ELECTORATE: {
    tone: 'blocked',
    title: 'No perteneces al padrón de esta votación',
    description: 'El padrón ya fue congelado y no puede ampliarse retrospectivamente. Verificarte ahora servirá para futuras votaciones elegibles.',
    remediation: 'residence',
    actionLabel: 'Preparar futuras votaciones',
    actionHref: '/dashboard/territory',
  },
}

export function eligibilityExperience(reasonCode: GovernanceEligibilityReasonCode): EligibilityExperience {
  return EXPERIENCE[reasonCode]
}

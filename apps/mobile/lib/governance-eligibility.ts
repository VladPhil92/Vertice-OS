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

export interface MobileEligibilityExperience {
  kind: 'positive' | 'warning' | 'blocked'
  title: string
  description: string
  actionLabel: string | null
  actionRoute: '/identity' | '/territory/assurance' | '/territory/select' | null
}

const EXPERIENCE: Record<GovernanceEligibilityReasonCode, MobileEligibilityExperience> = {
  ELIGIBLE_CURRENT_ASSURANCE: {
    kind: 'positive',
    title: 'Elegibilidad verificada',
    description: 'Tus pruebas vigentes cumplen las condiciones actuales de esta propuesta.',
    actionLabel: null,
    actionRoute: null,
  },
  ELIGIBLE_FROZEN_ELECTORATE: {
    kind: 'positive',
    title: 'Perteneces al padrón congelado',
    description: 'Tu elegibilidad fue fijada cuando abrió la votación y no depende de cambios posteriores del perfil.',
    actionLabel: null,
    actionRoute: null,
  },
  IDENTITY_ASSURANCE_UNAVAILABLE: {
    kind: 'blocked',
    title: 'Identity assurance no disponible',
    description: 'La infraestructura requerida no está operativa. La app no habilita un bypass.',
    actionLabel: null,
    actionRoute: null,
  },
  IDENTITY_ASSURANCE_REQUIRED: {
    kind: 'warning',
    title: 'Verifica tu identidad cívica',
    description: 'Esta participación requiere una prueba de identidad vigente de un proveedor autorizado.',
    actionLabel: 'Abrir identidad',
    actionRoute: '/identity',
  },
  TERRITORY_ASSURANCE_REQUIRED: {
    kind: 'warning',
    title: 'Verifica tu residencia',
    description: 'Las votaciones subnacionales requieren residencia verificable. GPS no sirve como prueba.',
    actionLabel: 'Verificar residencia',
    actionRoute: '/territory/assurance',
  },
  TERRITORY_ASSURANCE_EXPIRED: {
    kind: 'warning',
    title: 'Tu residencia verificada venció',
    description: 'Renueva antes del próximo congelamiento de padrón. La renovación no altera elecciones ya abiertas.',
    actionLabel: 'Renovar residencia',
    actionRoute: '/territory/assurance',
  },
  TERRITORY_SCOPE_MISMATCH: {
    kind: 'blocked',
    title: 'La propuesta corresponde a otro territorio',
    description: 'Tu residencia verificada no coincide con el ámbito de esta propuesta. El contexto de viaje no cambia la elegibilidad.',
    actionLabel: 'Revisar territorio',
    actionRoute: '/territory/assurance',
  },
  VOTER_ROLL_UNAVAILABLE: {
    kind: 'blocked',
    title: 'Padrón electoral no disponible',
    description: 'La votación está abierta sin un padrón utilizable. El voto permanece bloqueado por seguridad.',
    actionLabel: null,
    actionRoute: null,
  },
  NOT_IN_FROZEN_ELECTORATE: {
    kind: 'blocked',
    title: 'No perteneces al padrón de esta votación',
    description: 'El padrón ya está congelado. Verificarte ahora solo puede prepararte para futuras votaciones elegibles.',
    actionLabel: 'Preparar futuras votaciones',
    actionRoute: '/territory/assurance',
  },
}

export function mobileEligibilityExperience(reasonCode: GovernanceEligibilityReasonCode): MobileEligibilityExperience {
  return EXPERIENCE[reasonCode]
}

export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyMultibase: string
}

export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string
}

export interface DIDDocument {
  '@context': string[]
  id: string
  controller: string
  verificationMethod: VerificationMethod[]
  authentication: string[]
  service: ServiceEndpoint[]
  created: string
  updated: string
  // Extensión VÉRTICE — fuera del estándar W3C pero dentro del contexto custom
  verificationLevel: number
}

export interface VerificationStatus {
  citizen_id: string
  did: string
  level: number
  level_name: 'registrado' | 'cedula_confirmada' | 'identidad_completa'
  can_vote: boolean
  can_propose: boolean
}

import crypto from 'crypto'
import { config } from '../config'

export type CitizenRole = 'citizen' | 'moderator' | 'admin' | 'superadmin'

export interface AccessTokenPayload {
  sub: string           // citizen UUID
  did: string
  lvl: number           // verificationLevel
  role: CitizenRole     // active role for this session
  sid?: string          // session UUID; absent only on legacy tokens issued before role switching
  iat?: number
  exp?: number
}

// Hash opaco para almacenar refresh tokens — nunca el token en claro
export function hashToken(token: string): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(token).digest('hex')
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex')
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + config.JWT_REFRESH_EXPIRY_SECONDS * 1000)
}

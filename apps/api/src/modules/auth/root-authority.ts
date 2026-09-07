import { createHash } from 'node:crypto'

export const ROOT_SUPERADMIN_EMAIL = 'valderramapino@gmail.com' as const

// The raw CTG One auth.users UUID is deliberately not stored in the current
// source tree. Rotating this digest requires an explicit reviewed code change.
const ROOT_SUPERADMIN_CTG_ONE_SUBJECT_SHA256 =
  '4446b482e61fff7f0fcfc15f44983c2362e7f64aa32abd6c47b82e57f2d2de08' as const

export type FederatedRootAuthorityIdentity = {
  email: string
  subject: string
}

export function isCanonicalRootAuthority(identity: FederatedRootAuthorityIdentity): boolean {
  const subjectDigest = createHash('sha256').update(identity.subject, 'utf8').digest('hex')
  return identity.email.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL
    && subjectDigest === ROOT_SUPERADMIN_CTG_ONE_SUBJECT_SHA256
}

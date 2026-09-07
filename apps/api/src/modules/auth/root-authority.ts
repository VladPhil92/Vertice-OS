export const ROOT_SUPERADMIN_EMAIL = 'valderramapino@gmail.com' as const

// CTG One auth.users.id for the canonical VÉRTICE root identity. This UUID is
// an identifier, not a credential: possession of it cannot authenticate a user.
// Keeping the pin in source makes root-authority rotation an explicit, reviewed
// code change instead of an environment-only mutation.
export const ROOT_SUPERADMIN_CTG_ONE_SUBJECT = 'b7c5a0f0-0ff4-4470-9df5-aaa50fbf5405' as const

export type FederatedRootAuthorityIdentity = {
  email: string
  subject: string
}

export function isCanonicalRootAuthority(identity: FederatedRootAuthorityIdentity): boolean {
  return identity.email.trim().toLowerCase() === ROOT_SUPERADMIN_EMAIL
    && identity.subject === ROOT_SUPERADMIN_CTG_ONE_SUBJECT
}

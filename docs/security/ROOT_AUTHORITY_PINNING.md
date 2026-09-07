# P0 — Root Authority Pinning

## Objective

VÉRTICE has exactly one canonical CTG One identity that may execute the one-time root Superadmin bootstrap.

The invariant is:

- canonical email: `valderramapino@gmail.com`;
- canonical CTG One subject: immutable and pinned by SHA-256 inside the database guard;
- `bootstrap_superadmin` remains a server-managed CTG One authority, but the authority alone is insufficient;
- a mismatch in either the current federated email or the immutable subject fails closed;
- after the root bootstrap, ongoing Admin/Superadmin grants remain controlled from VÉRTICE by an already-authorized Superadmin.

The raw CTG One subject is intentionally not committed to the repository. VÉRTICE stores only its SHA-256 pin in the migration contract.

## Enforcement boundary

Migration `20260907203000_root_authority_pinning` installs a PostgreSQL trigger on `citizen_role_grants`.

For any active `admin` or `superadmin` grant whose source is `ctg_one_bootstrap`, PostgreSQL requires all of the following:

1. the local citizen email equals the canonical root email;
2. the linked CTG One identity has `email_at_link` equal to the canonical root email;
3. the SHA-256 of `external_identities.provider_subject` equals the pinned root subject digest.

Failure raises `ROOT_SUPERADMIN_IDENTITY_MISMATCH` and aborts the enclosing transaction. Since the bootstrap grants are created inside one transaction, a mismatch cannot leave a partially elevated role set.

## Existing-state preflight

The migration also performs a preflight before installing the trigger. If an existing active CTG One bootstrap Admin/Superadmin grant does not resolve to the canonical root identity, migration deployment fails with `ROOT_SUPERADMIN_EXISTING_IDENTITY_MISMATCH`.

This prevents a drifted production state from being silently accepted by the new guard.

## Threat model

The pin closes these paths:

- CTG One accidentally issuing `bootstrap_superadmin` to a different subject;
- a stale or future VÉRTICE application path attempting the same bootstrap for another identity;
- an ORM mutation attempting to create a CTG One bootstrap Admin/Superadmin grant directly;
- stale local email state masking a changed upstream CTG One email.

The pin does not replace CTG One authentication, PKCE exchange, email verification, live role grants, session-scoped `active_role`, or the last-Superadmin guard. It composes with those controls.

## Rotation

Changing the root identity is a security-sensitive governance operation. It requires an explicit reviewed migration/code change that updates the canonical email and/or subject digest. It must never be implemented as a user-editable field or an automatic first-user rule.

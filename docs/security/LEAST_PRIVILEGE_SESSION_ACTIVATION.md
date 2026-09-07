# P1 — Least-Privilege Session Activation

## Invariant

Role assignment and session activation are separate security decisions.

A citizen may hold durable elevated grants (`moderator`, `admin`, `superadmin`) without a newly authenticated session inheriting any of them. Every new VÉRTICE session starts with `active_role = citizen` and an access token whose `role` claim is `citizen`.

This applies equally to:

- local email/password login;
- ordinary CTG One federation;
- the canonical CTG One root exchange that establishes or confirms the one-time `superadmin` bootstrap grant.

## Explicit elevation

Elevated authority becomes active only through the role-switch boundary. `switchSessionRole` requires:

1. a live, unrevoked session id;
2. the requested role to be a valid VÉRTICE role;
3. a live `citizen_role_grants` row for that role;
4. issuance of a new access token carrying the explicitly selected role;
5. an audit event recording the transition.

Refresh does not create a new authorization decision. Once a user has explicitly selected an elevated role in an existing session, refresh may preserve that role only while the corresponding live grant continues to exist. Revocation or grant removal causes the role context to fall back to `citizen`.

## Root authority

Root bootstrap remains a durable-grant operation only. Successfully proving the canonical CTG One root identity may create or confirm its `superadmin` grant, but it never directly issues a privileged session token.

This ensures that possession of root authority is not equivalent to continuously exercising root authority.

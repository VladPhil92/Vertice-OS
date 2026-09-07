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

1. a live, unrevoked session id (`sid`);
2. the requested role to be a valid VÉRTICE role;
3. a live `citizen_role_grants` row for that role;
4. an update of that session's `active_role`;
5. issuance of a new access token carrying the explicitly selected role;
6. an audit event recording the transition.

Privileged middleware binds all three pieces together on every request: token role, live role grant, and the same live session's `active_role`. A legacy access token without `sid` may authenticate to ordinary endpoints but cannot enter the privileged control plane.

Refresh does not create a new authorization decision. Once a user has explicitly selected an elevated role in an existing session, refresh may preserve that role only while the corresponding live grant and active session selection continue to exist. Revocation or grant removal causes the role context to fall back to `citizen`.

## Immediate cutover

Migration `20260907223000_least_privilege_session_activation` performs an explicit least-privilege cutover:

1. every active `moderator`, `admin`, or `superadmin` session is reset to `citizen`;
2. existing elevated JWTs immediately fail privileged middleware because their token role no longer matches `sessions.active_role`;
3. a PostgreSQL `BEFORE INSERT` trigger rejects any future session created with an elevated role using `SESSION_MUST_START_AS_CITIZEN`;
4. later role activation remains possible through the audited `UPDATE` performed by the explicit role-switch flow.

Users with valid durable grants do not lose the grant itself. They only need to explicitly activate the elevated role again in their live session.

## Root authority

Root bootstrap remains a durable-grant operation only. Successfully proving the canonical CTG One root identity may create or confirm its `superadmin` grant, but it never directly issues a privileged session token.

This ensures that possession of root authority is not equivalent to continuously exercising root authority.

## Deployment boundary

The one-time P0 migration recovery shim is removed after successful production reconciliation. Steady-state production boot remains fail-closed:

`prisma migrate deploy → privilege audit → unprivileged Node process`

The canonical root audit therefore continues to protect durable authority independently of this session-activation layer.

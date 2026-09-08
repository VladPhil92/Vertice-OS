# Dashboard Runtime & Data Convergence — Phase 4

## Objective

Phase 4 converts the authenticated dashboard from a collection of independent client-side data sessions into a shared civic runtime. The goal is not a visual redesign; it is to establish one coherent source of truth before Command Center v2.

## Problem addressed

Before this phase, the dashboard home mounted several independent surfaces that requested overlapping contracts:

- dashboard identity requested civic profile, avatar and `/dashboard/me`;
- the experience layer requested `/dashboard/me` and civic profile again;
- the citizen command center requested `/dashboard/me` again;
- the action resolution plan maintained its own `/dashboard/me/resolution` lifecycle;
- role switching replaced the access token and forced a full browser reload.

This created duplicated network work, locally divergent snapshots and brittle refresh behavior after mutations.

## P4.1 — Shared runtime contract

`DashboardIdentityProvider` now also acts as the dashboard runtime provider while preserving the existing `useDashboardIdentity()` API.

New semantic consumer API:

```ts
useDashboardRuntime()
```

Shared domains:

- civic profile;
- avatar;
- dashboard snapshot;
- resolution plan;
- identity-derived presentation state;
- loading / refreshing / recoverable error state.

The provider uses per-domain request sequencing so an identity refresh, dashboard refresh and resolution refresh cannot invalidate each other's responses.

## P4.2 — Read convergence

`apiFetch` now coalesces dashboard reads in two layers:

1. existing in-flight request deduplication;
2. a short-lived, memory-only 1.5 second read cache for runtime contracts.

Cached runtime paths:

- `/community/profile/me`;
- `/community/profile/me/avatar`;
- `/dashboard/me`;
- `/dashboard/me/resolution`.

The cache is deliberately ephemeral. It is not persistent civic state and does not survive reloads.

## P4.3 — Domain invalidation

Successful mutations now invalidate the relevant runtime domain and broadcast a browser event consumed by the shared provider.

Scopes:

- `identity`;
- `dashboard`;
- `resolution`;
- `notifications`;
- `all`.

Civic action, territorial, proposal, governance, legal and workflow mutations invalidate the complete civic runtime. Profile/avatar mutations invalidate identity and the dashboard projection.

## P4.4 — Consumer migration

Migrated directly to the shared runtime:

- `DashboardExperienceLayer`;
- `DashboardActionResolutionPlan`.

`CitizenCommandCenter` remains a compatibility component until the Phase 5 visual rewrite. It is mounted through `CitizenCommandCenterRuntime`, which synchronizes its lifecycle to the canonical `generated_at` snapshot while its legacy `/dashboard/me` read is coalesced by the shared API cache.

This avoids a high-risk rewrite of the large command-center component immediately before replacing it with Command Center v2.

## P4.5 — Role continuity

`RoleSwitcher` no longer performs `window.location.reload()` after a successful capability-context switch.

Instead it:

1. stores the new access token;
2. updates the active role state;
3. invalidates the complete dashboard runtime;
4. lets subscribed dashboard surfaces refresh under the new JWT.

Backend authorization remains authoritative. This is an experience/runtime change, not a relaxation of capability controls.

## P4.6 — Browser certification

`apps/web/e2e/dashboard-runtime.spec.ts` certifies that concurrent dashboard consumers produce one effective `/dashboard/me` network read during initial dashboard hydration.

The `Dashboard Browser Release Gate` now runs:

- `e2e/dashboard.spec.ts`;
- `e2e/dashboard-runtime.spec.ts`;
- `e2e/report-media.spec.ts`.

The workflow also triggers for runtime and role-switcher changes.

## Security invariants

Phase 4 does not move authorization into the client and does not persist privileged server responses outside memory.

- refresh cookies remain first-party/httpOnly on the server contract;
- access-token behavior is unchanged by this phase;
- role/capability enforcement remains server-side;
- cache entries are memory-only and expire after 1.5 seconds;
- successful protected mutations invalidate cached runtime projections.

## Relationship to Phase 3

Phase 4 is developed on top of the Phase 3 Media & Territorial Evidence implementation. Report/evidence mutations participate in the new runtime invalidation contract.

Production photo activation still requires Cloudflare Images configuration. Runtime convergence itself has no Cloudflare dependency.

## Deferred to Phase 5

Phase 4 intentionally does not redesign the dashboard hierarchy. Phase 5 will use this stable runtime to replace the layered home experience with Command Center v2:

- next best civic action;
- unified attention queue;
- compact management status;
- territorial snapshot;
- unified activity surface.

# Phase 7H — Closed Pilot Readiness

Snapshot: 10 September 2026.

## Objective

Phase 7H creates a machine-verifiable boundary between a code-complete platform and a bounded real-user pilot. It does **not** certify VÉRTICE for public/commercial release and it does not authorize binding elections, production KYC authority, real-money collection or payouts.

The target is a web/PWA pilot with **10–30 invited users**, using Cartagena as the first operational node while preserving the national territorial architecture.

## Pilot release ladder

1. `IMPLEMENTED` — pilot policy and endpoint exist in source.
2. `CODE_GATE_PASS` — exact-SHA source/type/test contract passes.
3. `READY_FOR_RUNTIME_VALIDATION` — candidate may be deployed for runtime verification.
4. `BLOCKED` — any mandatory runtime dependency/safeguard is not satisfied.
5. `READY_FOR_CLOSED_PILOT` — the exact production SHA returns HTTP 200 from `/health/pilot` and the operator runbook has no stop condition.

`READY_FOR_CLOSED_PILOT` is deliberately narrower than `CERTIFIED FOR MARKET RELEASE`.

## Mandatory runtime dependencies

The closed pilot requires all of the following to report healthy:

- PostgreSQL/PostGIS authority path;
- Redis cache/rate-limit/operational path;
- Neo4j Community/social-graph path.

Generic `/health/ready` may continue serving civic basics with an optional Neo4j degradation. `/health/pilot` is stricter because the pilot explicitly exercises Community, following/feed and graph-backed social behavior.

## Enforced invite boundary

The pilot is not considered closed merely because an operator promises to share the URL selectively. Phase 7H provides an executable authentication boundary controlled by:

- `CLOSED_PILOT_MODE=true`;
- `CLOSED_PILOT_EMAIL_ALLOWLIST=<comma-separated invited emails>`.

When pilot mode is enabled, registration, password login, refresh-token renewal and CTG One federation all reject identities outside the normalized allowlist with `CLOSED_PILOT_INVITE_REQUIRED`. The allowlist is never emitted by `/health/pilot`; only whether it is configured and its cohort size are observable.

The code caps the configured pilot cohort at 30 identities. An empty or oversized allowlist makes the access control `BLOCKED`. The operational target remains 10–30 invited users.

Existing access tokens may remain valid until their normal short expiry, so pilot activation must occur only after the operator has established the allowlist and allowed any pre-pilot access-token window to expire or revoked relevant sessions.

## Mandatory safeguards

The pilot contract is fail-closed around high-impact capabilities:

- access mode: `closed_invite_only`;
- governance: `consultative_only`;
- monetary operations: `disabled`;
- account deletion: `required`;
- moderation: `required`.

All four monetary capability surfaces must remain disabled:

- `payments`;
- `crowdfunding_payments`;
- `payouts`;
- `crowdfunding_payouts`.

A capability in `ready` or `misconfigured` state blocks this first pilot. This is intentional: provider credentials and financial canaries belong to their separate certification track.

## Exact-SHA rule

Production must expose an immutable revision. A production runtime with `revision=unknown` is `BLOCKED`. Runtime evidence is valid only for the exact source SHA being evaluated.

## Pilot scope

Expected real-user journeys include:

- signup/login/session/logout;
- territorial selection and local experience;
- civic profile;
- Community/feed/follow-unfollow;
- citizen reports and evidence;
- consultative proposals/governance exploration;
- workflows/case detail;
- reputation surfaces;
- moderation/reporting controls;
- irreversible account deletion.

Identity-provider certification, signed native mobile builds, payments, payouts and legally/institutionally binding governance remain outside the initial pilot authority.

## Exit criterion

Phase 7H reaches `READY_FOR_CLOSED_PILOT` only when:

- the exact candidate SHA passes the Phase 7H code gate and applicable repository gates;
- that SHA is deployed to the intended production/pilot runtime;
- `/health/live` and `/health/ready` pass;
- `/health/pilot` returns HTTP 200 with no blockers;
- invite-only access is enabled and configured for the bounded cohort;
- Vercel/API runtime evidence points to the intended release lineage;
- the Closed Pilot Runbook has been executed without a STOP condition.

Code cannot fabricate runtime readiness. A green PR is necessary but not sufficient.

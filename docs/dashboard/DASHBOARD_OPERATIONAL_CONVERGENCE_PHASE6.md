# Dashboard Operational Convergence — Phase 6

## Objective

Move VÉRTICE OS from a collection of functional dashboard modules toward one operational system that tells each user what requires attention, exposes complete crowdfunding readiness, and gives privileged operators a dedicated compliance control plane.

## Scope

### Cross-domain operational attention

`/dashboard` now mounts a lightweight attention bridge above Command Center v2. It reads existing domain contracts without duplicating domain rules and surfaces only actionable conditions from:

- crowdfunding campaign readiness and activation;
- payout profile readiness;
- civic workflows;
- Pro subscription renewal state.

The bridge is intentionally non-promotional. Free users are not shown an upgrade nag. It renders only when an operational next step exists.

### Crowdfunding citizen operations

`/dashboard/crowdfunding` evolves from a campaign list into an operational workspace:

- aggregate raised/goal/operating metrics;
- campaign lifecycle and compliance state;
- readiness for collection and payout;
- self-service request for payout-profile review;
- campaign activation once compliance + identity + payout readiness allow it;
- self-service BRE-B destination resolution and confirmation;
- canonical fee policy from `/crowdfunding/config`;
- explicit reputation neutrality.

The browser never decides whether a campaign is eligible. Activation, review, BRE-B resolution, and destination binding remain server-authoritative.

### Crowdfunding admin operations

`/dashboard/admin/crowdfunding` exposes the existing server-side review queues:

- campaigns pending compliance review;
- payout profiles pending review;
- approve/reject/suspend decisions;
- KYC/KYB provider reference required by UI when approving a payout profile;
- review notes.

Approval does not move money. Payment and payout execution remain controlled by provider certification, reconciliation, verified BRE-B destination binding, financial risk gates, and feature flags.

## Invariants

1. Money never changes civic reputation, rank, verification, voting weight, organic reach, or civic authority.
2. Crowdfunding policy remains sourced from backend canonical configuration.
3. Administrators cannot choose an arbitrary beneficiary payout destination.
4. Beneficiaries resolve and confirm their own BRE-B destination.
5. Operational attention does not create a second source of truth; it reads existing domain states.
6. Missing optional domain data must not make the dashboard homepage unavailable.
7. Free civic access is not degraded or nagged by the cross-domain attention layer.

## Superseded work

This phase replaces the overlapping frontend work previously attempted in PR #119. It starts from current `main`, after merged PRs #117 and #118, to avoid duplicated imports, duplicated campaign fields, duplicated form state, and divergent crowdfunding policy implementations.

## Release criteria

Do not merge until:

- TypeScript lint/typecheck are green;
- API tests remain green;
- frontend runtime contract is green;
- Dashboard Browser Release Gate is green;
- Railway runtime contract is green;
- identity-provider certification is green;
- security/SAST checks are green.

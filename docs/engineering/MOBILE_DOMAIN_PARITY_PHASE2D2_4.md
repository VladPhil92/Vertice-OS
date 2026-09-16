# Phase 2D-2/3/4 — Native Domain Parity Completion

## Purpose

Complete the repository-automatable native parity backlog after Phase 2D-1 Community/Feed without creating parallel domain engines in React Native.

This phase consumes existing server contracts for:

1. civic workflows/cases;
2. Civic Identity Assurance and provider bootstrap;
3. crowdfunding campaign/readiness tracking.

## Phase 2D-2 — Workflows / civic cases

Native routes:

- `/workflows` → `GET /workflows/cases`;
- `/workflows/[id]` → `GET /workflows/cases/:id`;
- origin report handoff → existing `/report/[id]`.

The client displays the durable case progression returned by the API. It does not run territorial analysis, create proposals, create legal-control documents, derive voting authority, or calculate workflow stages locally.

## Phase 2D-3 — Identity Assurance

Native route `/identity` consumes:

- `GET /identity/assurance`;
- `GET /identity/proofing`;
- `GET /identity/providers/availability`;
- `POST /identity/providers/veriff/session`.

The provider handoff accepts HTTPS only. Starting a Veriff session does not mean the citizen is assured. Governance eligibility remains fail-closed until the backend confirms all canonical conditions: contact verification, operational provider ingress, active proof and external provider certification.

Production Veriff credentials and the external evidence-backed canary remain external/operator-controlled release evidence.

## Phase 2D-4 — Crowdfunding (pre-launch announcement)

Native route `/crowdfunding` no longer consumes the readiness/campaigns API. Until Mercado Pago/Wompi credentials and payout certification are live (`docs/CURRENT_STATE.md` section 6), the route shows a static announcement (launch month `octubre de 2026`) instead of a technical readiness/blockers dashboard, so a citizen is never shown jargon-heavy compliance state (`platform_blocked`, raw blocker codes) it cannot act on.

The canonical routes remain implemented and tested server-side for the web client and for reconnecting mobile once the surface is built for real:

- `GET /crowdfunding/me/readiness`;
- `GET /crowdfunding/me/campaigns`.

This slice intentionally does **not** execute:

- contribution checkout;
- campaign activation;
- payout requests;
- BRE-B destination mutation;
- settlement/refund reconciliation;
- admin compliance decisions.

Financial authority remains entirely server-side. Payments, donations, KYC/KYB, subscriptions and payouts never create civic reputation, ranking, voting weight or authority.

## Navigation

The mobile command center exposes the three workspaces under “Continúa tu gestión” while preserving the existing primary tabs. This avoids turning secondary operational domains into competing top-level navigation.

## Exact-SHA evidence

`Mobile Domain Parity` must verify:

- deterministic source contract;
- native TypeScript typecheck;
- Android Expo export;
- iOS Expo export;
- compatibility with the existing Mobile Core Parity and Mobile Device Release gates.

## Release semantics

- **IMPLEMENTED**: source surfaces and contracts are present.
- **INTEGRATED**: merged to `main` with exact-SHA CI green.
- **DEPLOYED**: a signed EAS artifact containing the SHA is distributed.
- **READY**: physical Android/iOS smoke validates these journeys against production/staging origins.
- **CERTIFIED**: where external providers apply, the corresponding provider canary is current and evidence-backed.

## External boundary

The repository can reach IMPLEMENTED/INTEGRATED automatically. The following cannot be truthfully manufactured by source changes:

- EAS/Apple/Google signing ownership;
- physical-device smoke;
- APNs/FCM/Maps credentials;
- Veriff production credentials and external canary;
- Mercado Pago/Wompi/BRE-B production certification;
- App Store / Play Store review.

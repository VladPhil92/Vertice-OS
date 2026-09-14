# Phase — Financial & Crowdfunding Safety Convergence

## Objective

Converge the native crowdfunding/readiness surface on the canonical VÉRTICE product language while making the financial authority boundary explicit and mechanically enforceable.

This phase follows Workflow & Case Management Convergence. The crowdfunding screen already consumed the canonical readiness APIs but still used the retired beige/green visual layer and compressed several materially different concepts — user readiness, provider readiness, campaign lifecycle, collection eligibility and recorded amounts — into a simple status presentation.

The phase improves financial-state comprehension without enabling money movement from the native client.

## Runtime delivered

### Canonical crowdfunding surface

`apps/mobile/app/crowdfunding/index.tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter/DM Mono aliases, VÉRTICE brand assets and the semantic icon boundary.

The screen preserves the existing read contracts:

- `GET /crowdfunding/me/readiness`
- `GET /crowdfunding/me/campaigns`

No new checkout, contribution, campaign-activation or payout mutation is introduced by this tranche.

### Readiness semantics

Readiness is now represented as a server snapshot rather than a binary local switch. The interface distinguishes:

- ready / verified;
- action required;
- pending review;
- blocked;
- platform blocked / disabled / misconfigured.

The UI separately exposes person-level readiness, payout profile, payout destination and platform capabilities including CTG One federation, collection provider, crowdfunding collection, payout provider, payout execution and payout certification.

The screen also renders `generated_at`, making the temporal nature of the readiness snapshot visible.

### Blocker provenance

Blockers retain their backend-provided scope:

- user;
- campaign;
- platform.

The client does not reinterpret platform blockers as user tasks. The only native navigation introduced is the already-existing identity route when the backend reports `IDENTITY_VERIFICATION_REQUIRED`.

Backend `action_href` values that point to dashboard web operations are not translated into native financial permissions. The interface instead explains that those actions remain web/operator concerns.

### Campaign safety comprehension

Campaign cards now separate lifecycle readiness, activation eligibility and contribution eligibility.

Progress remains a display of API-provided `raised_amount_cop` against `goal_amount_cop`; the percentage is clamped to the visual range 0–100. The interface explicitly states that the displayed amount is not local proof of bank settlement.

Campaign-specific blockers and compliance review notes are surfaced when present.

## Financial authority boundary

This phase codifies the following invariants in-product:

- the backend and certified providers remain authoritative for activation, collection, settlement, refund and payout;
- a local `ready` rendering is not a settlement event;
- a recorded raised amount is not proof of bank settlement;
- Mobile does not execute checkout or payouts in this convergence tranche;
- payments, donations, KYC/KYB, subscriptions, settlement and payouts do not modify civic reputation, ranking, vote or authority;
- feature flags, ledgers and provider certification remain server-side sources of truth.

## Regression gate

`apps/mobile/scripts/verify-financial-crowdfunding-safety.mjs` certifies the native crowdfunding surface. It fails if the screen:

- loses the canonical theme, brand or icon adapters;
- imports Lucide directly;
- reintroduces local hexadecimal colors or raw font families;
- restores Unicode glyphs as primary icons;
- removes either readiness/campaign read contract;
- removes the explicit financial authority and settlement boundaries;
- removes the lower/upper clamp on visual campaign progress;
- introduces `apiMutation`, `POST`, contribution checkout or payout-execution endpoints;
- attempts to translate `/dashboard/*` web routes into native financial permissions.

The gate is chained into Mobile Core Parity through `verify-font-alias-contract.mjs`.

## Existing server controls preserved

This phase does not replace or weaken the existing crowdfunding readiness service. Server-side readiness continues to combine identity verification, payout-profile status, payout destination, feature capabilities and payout-provider certification. Campaign activation/contribution eligibility continues to be calculated by the API.

No fee policy, payment ledger, idempotency, refund, reconciliation, payout readiness, BRE-B binding, provider adapter, emergency stop or financial operations contract is changed here.

## External certification boundary

Repository convergence is not equivalent to real-money certification. Open financial operation still requires the external evidence already defined by the market-release completion matrix, including bounded real checkout, authenticated provider lifecycle, settlement, refund, payout and reconciliation evidence.

## Next tranche

With the major secondary mobile domains now converged, the next repository-automatable phase should be **Release Candidate Hardening & Evidence Synchronization**: synchronize current-state documentation, audit remaining legacy styles/dead code, tighten accessibility/performance/bundle budgets, and produce a single release-candidate evidence view before operator-owned EAS, device, provider and store work.

## Release certification

This phase is certified only when the exact PR head passes the applicable repository gates, including Mobile Core Parity, native typecheck, Android/iOS export assertions, Mobile Domain Parity, Golden API/Browser journeys, security scans and repository CI. Source integration does not constitute App Store/Play Store publication, provider certification, real-money operation or physical-device validation.

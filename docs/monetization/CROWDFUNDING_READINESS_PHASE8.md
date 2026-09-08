# Crowdfunding Phase VIII — Compliance & Financial Readiness

## Objective

Phase VIII converts the previously separate identity, KYC/KYB, payout-destination and provider controls into one fail-closed readiness graph. A campaign may complete editorial/compliance review without being financially activatable. `active` now means the platform has verified the prerequisites required to accept real money.

## Readiness graph

The creator-side readiness graph evaluates:

1. **Identity** — the citizen must have verified identity.
2. **Payout profile** — KYC/KYB review must be `verified` and payout status `eligible`.
3. **Beneficiary destination** — the beneficiary must personally resolve and confirm a BRE-B destination. VÉRTICE stores only the existing HMAC fingerprint and non-sensitive key type.
4. **Collection rail** — Mercado Pago configuration plus `CROWDFUNDING_PAYMENTS_ENABLED` must produce capability `ready`.
5. **Payout provider** — Wompi Pagos a Terceros configuration must be `ready`.
6. **Payout certification** — the latest `wompi_payouts` operational certification must be `verified`.
7. **Campaign lifecycle** — only `verified/verified` campaigns may transition to `active`.

`CROWDFUNDING_PAYOUTS_ENABLED` is deliberately **not** required to activate fundraising. It remains the later payout-execution release switch. The payout provider and certification, however, must already be ready before VÉRTICE accepts contributions.

## Runtime enforcement

### Activation gate

`POST /crowdfunding/me/campaigns/:campaignId/activate` re-evaluates the full readiness graph immediately before changing `verified -> active`.

Platform blockers return 503 and user/campaign blockers return 409. No provider secret, bank data or raw KYC document is exposed by the readiness API.

### Live checkout circuit breaker

`POST /crowdfunding/campaigns/:campaignId/contributions/checkout` now re-evaluates beneficiary and platform readiness before creating a payment transaction. This prevents an already-active campaign from continuing to accept money after its payout profile, destination, collection provider or payout certification becomes invalid/unavailable.

The existing payment service remains independently fail-closed on Mercado Pago configuration and `CROWDFUNDING_PAYMENTS_ENABLED`.

## API

Creator:

- `GET /crowdfunding/me/readiness`
- `GET /crowdfunding/me/campaigns/:campaignId/readiness`
- existing payout-review and BRE-B self-service endpoints remain canonical for mutations.

The readiness response includes coarse capability states only (`ready`, `disabled`, `misconfigured`) and never secret values.

## Dashboard

`/dashboard/crowdfunding/readiness` provides a single workspace for:

- identity status and navigation;
- KYC/KYB payout-profile review request;
- BRE-B self-service confirmation when the provider is available;
- collection/payout runtime capability status;
- explicit blocker list;
- campaign-level readiness and activation.

## Production behavior before financial credentials

Deploying this phase does **not** enable real payments by itself. In an environment without Mercado Pago/Wompi production variables, the readiness graph reports platform blockers and campaign activation/checkout fail closed.

Operators must never use placeholder credentials to turn these gates green.

## Civic invariant

Financial readiness is operational only. Identity review for payouts, subscriptions, contributions, provider status and payout eligibility do not change civic reputation, ranking, voting weight, verification authority, algorithmic reach or organic reach.

## Runtime hardening

The API Docker image is upgraded from Node 20 to Node 22 so the production container matches the monorepo engine contract (`>=22.13.0`) and CI runtime family.

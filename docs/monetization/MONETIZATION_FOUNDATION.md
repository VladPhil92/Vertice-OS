# VÉRTICE OS — Monetization Foundation v1

**Status:** implemented foundation  
**Launch currency:** COP  
**Consumer plans:** Free / Pro

## Product principle

> Money buys tools in VÉRTICE, never civic reputation or influence.

The monetization bounded context is intentionally separated from identity, governance and reputation. The following events **must never directly change** `reputation_score`, ranking weight or voting power:

- starting, renewing or cancelling a subscription;
- paying VÉRTICE;
- donating to a campaign;
- raising more money in a campaign;
- receiving sponsorship;
- purchasing future marketplace products or services.

Any future civic-reputation effect must originate from the existing evidence/impact workflow and be independently justified by verified civic outcomes.

## Plans

### VÉRTICE Free — $0 COP

Free is the complete participation layer. It includes:

- civic profile and community participation;
- core civic actions and evidence;
- complete civic reputation visibility;
- crowdfunding contributions;
- up to 3 active projects;
- 250 MB of evidence storage;
- 20 AI requests/month;
- no scheduled publishing automation.

### VÉRTICE Pro — $15,000 COP/month

Annual launch price: **$150,000 COP/year**.

Pro expands operating capacity rather than civic power:

- up to 50 active projects;
- 5 GB of evidence storage;
- 500 AI requests/month;
- advanced analytics;
- reports/exports;
- publishing automation;
- advanced crowdfunding analytics.

The launch limits are abuse/cost-control ceilings and can be tuned later without changing the core Free/Pro contract.

## Canonical API contract

### `GET /billing/plans`

Public catalog for Free/Pro pricing, entitlements, quotas and the reputation-neutrality policy.

### `GET /billing/me`

Authenticated effective-plan resolver. An account with no live paid subscription is **Free by default**; no database row is required for Free.

### Feature gates

Use:

```ts
requireEntitlement(ENTITLEMENTS.ANALYTICS_ADVANCED)
```

A failed gate returns HTTP `403` with code `PLAN_UPGRADE_REQUIRED` and never changes authentication, verification or reputation state.

The first production gate in this foundation is:

- `GET /crowdfunding/me/analytics` → `crowdfunding:analytics` → Pro.

## Subscription persistence

`subscriptions` records only provider-backed subscription state. Important rules:

- absent subscription = Free;
- at most one `trialing`/`active` subscription per citizen;
- paid plans require `monthly` or `annual` billing cycle;
- provider subscription IDs are unique when present;
- entitlement resolution only accepts live `trialing`/`active` rows within their current period.

## Payment ledger

`payment_transactions` is the provider-neutral ledger for:

- subscription payments;
- crowdfunding contributions;
- optional platform tips;
- refunds;
- payouts.

It is intentionally separate from `reputation_events`.

## Payment-provider boundary

`BillingProvider` defines the provider adapter contract. A browser redirect or success page must **never** grant Pro by itself.

A future provider implementation must follow this sequence:

1. authenticated citizen requests checkout;
2. API creates provider checkout session;
3. provider processes payment;
4. provider sends a signed server-to-server webhook;
5. webhook signature and event idempotency are verified;
6. payment ledger is updated;
7. only then is `subscriptions` activated/renewed;
8. `/billing/me` resolves Pro.

This design supports Wompi, Mercado Pago or another provider without coupling product logic to one vendor.

## Surfaces

- `/pricing` — public Free/Pro comparison;
- `/dashboard/billing` — authenticated effective-plan view;
- public navigation now exposes **Planes**.

## Not yet enabled

This foundation deliberately does **not** fake a live checkout. The following require the selected payment provider, merchant credentials and signed webhook certification:

- card/PSE checkout;
- automatic renewal;
- cancellation at provider;
- refunds from dashboard;
- invoices/receipts;
- provider reconciliation.

## Next implementation slice

1. select Colombian payment provider;
2. add provider-specific adapter behind `BillingProvider`;
3. add checkout + signed webhook + idempotency tests;
4. persist usage meters for AI/storage/project quotas;
5. expose cancellation/renewal controls;
6. add Organization plans after individual billing is proven in production.

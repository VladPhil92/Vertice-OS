# VÉRTICE OS — Payment Execution Phase II

## Objective

This phase connects the monetization foundation to a verifiable payment lifecycle while preserving the product invariant that money never changes civic reputation, ranking, voting weight, verification, or organic reach.

The first adapter is Mercado Pago. Provider-specific code remains behind the billing boundary so another provider can be added without rewriting entitlement, subscription, reputation, or crowdfunding business rules.

## Supported flows

### VÉRTICE Pro

1. Authenticated citizen selects monthly or annual Pro.
2. API creates a local `payment_transactions` row in `pending` state.
3. API creates a Mercado Pago recurring preapproval and returns its hosted checkout URL.
4. Browser leaves VÉRTICE for the provider checkout.
5. Returning to VÉRTICE does **not** activate Pro.
6. A signed provider webhook or explicit server-side reconciliation retrieves the current provider resource.
7. Preapproval/mandate `authorized` changes the local checkout only to `authorized`; it does **not** grant Pro.
8. Only an approved recurring charge (`subscription_authorized_payment` with provider payment status `approved`) activates or renews Pro.
9. Cancellation is sent to the provider first; local state never pretends cancellation succeeded when the provider call failed.

Launch prices remain:

- Monthly: COP 15,000
- Annual: COP 150,000

### Crowdfunding contribution checkout

A contribution can only create a provider checkout when all of these conditions are true:

- global `CROWDFUNDING_PAYMENTS_ENABLED=true`;
- payment provider capability is `ready`;
- campaign is `active`;
- campaign `compliance_status=verified`;
- campaign is not expired;
- campaign creator has verified identity;
- campaign creator has a `crowdfunding_payout_profiles` record with `verification_status=verified` and `payout_status=eligible`.

A campaign being socially/culturally valid is therefore not equivalent to being financially enabled.

## Provider configuration

All values are feature-scoped. Missing payment credentials must never stop the civic API from booting.

Required for `payments=ready`:

```text
MERCADOPAGO_ACCESS_TOKEN=<secret>
MERCADOPAGO_WEBHOOK_SECRET=<secret>
PAYMENTS_WEB_URL=https://<canonical-web-host>
PAYMENTS_WEBHOOK_URL=https://<canonical-web-host>/api/billing/webhooks/mercadopago
```

Optional:

```text
MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS=300
CROWDFUNDING_PAYMENTS_ENABLED=false
```

Keep crowdfunding payments disabled until KYC/KYB operational review and the payout process are certified.

## Webhook security

The webhook endpoint is session-unauthenticated by design because its authority comes from the provider signature, not a VÉRTICE login token.

Controls:

- HMAC-SHA256 validation using the provider webhook secret;
- constant-time signature comparison;
- signed `data.id`, request ID when present, and timestamp;
- replay-window enforcement;
- event-level deduplication in `payment_webhook_events`;
- resource state is fetched server-to-server from Mercado Pago before local entitlement/ledger mutations;
- unsupported webhook topics are persisted as `ignored`, never treated as success.

The notification body itself is not sufficient evidence of payment.

## Idempotency and ambiguous failures

`payment_transactions.idempotency_key` protects checkout creation locally.

For modern Checkout Pro orders, the adapter also sends `X-Idempotency-Key` to Mercado Pago.

For recurring preapprovals, if the network fails after the provider may have accepted creation, VÉRTICE leaves the local transaction pending and returns `PAYMENT_RECONCILIATION_REQUIRED`. It does not blindly create a second subscription checkout.

## Ledger transitions

### Subscription

```text
pending -> authorized   # mandate accepted; no Pro entitlement yet
authorized -> paid      # approved charge; Pro may become active
pending|authorized -> cancelled
renewal approved -> new paid ledger entry
renewal failed -> subscription may become past_due after paid period expires
```

Pro entitlements are derived from an `active` or `trialing` subscription whose period has not expired. An `authorized` checkout transaction alone is never sufficient.

### Crowdfunding contribution

```text
pending -> paid
pending -> failed
pending -> cancelled
paid -> refunded
paid -> chargeback
```

`crowdfunding_campaigns.raised_amount_cop` changes only inside the same database transaction as the contribution state transition:

- first transition to `paid`: increment once;
- `paid -> refunded|chargeback`: decrement once;
- duplicate webhook: no balance change.

## KYC/KYB and payout readiness

This phase stores only a coarse operational decision:

- `pending`
- `in_review`
- `verified`
- `rejected`
- `suspended`

and payout eligibility:

- `disabled`
- `eligible`
- `blocked`

It does **not** store bank account numbers, cards, payout credentials, or KYC document images. A successful administrator review requires a provider-side reference so VÉRTICE has evidence that the external verification exists.

## Administrative endpoints

Authenticated citizen:

```text
GET  /crowdfunding/me/payout-readiness
POST /crowdfunding/me/payout-readiness/request-review
POST /crowdfunding/me/campaigns/:campaignId/activate
```

Admin control plane:

```text
GET  /crowdfunding/admin/review-queue
POST /crowdfunding/admin/campaigns/:campaignId/review
POST /crowdfunding/admin/payout-profiles/:citizenId/review
```

Billing:

```text
POST /billing/checkout
POST /billing/cancel
POST /billing/reconcile
POST /billing/webhooks/mercadopago
```

Crowdfunding payment:

```text
POST /crowdfunding/campaigns/:campaignId/contributions/checkout
```

## Deployment sequence

1. Merge code and database migration.
2. Confirm migration applied successfully.
3. Keep provider credentials absent or crowdfunding flag false until provider dashboard is configured.
4. Configure canonical HTTPS web URL and webhook URL.
5. Configure Mercado Pago production access token and webhook secret in the deployment secret store, never in Git.
6. Verify `/health/ready` reports `payments=ready`.
7. Run a low-value Pro canary and confirm: local pending transaction -> mandate authorized -> approved charge webhook -> active Pro.
8. Test cancellation and renewal reconciliation.
9. Complete KYC/KYB/payout operational certification.
10. Only then set `CROWDFUNDING_PAYMENTS_ENABLED=true` and run a low-value crowdfunding canary.

## Explicitly deferred

The following are not activated by this phase:

- storing raw bank credentials;
- automated payouts from VÉRTICE;
- split payments to campaign creators;
- electoral/political campaign financing;
- equity, debt, revenue-share, profit-share or token crowdfunding;
- any reputation boost based on purchase, donation, tips, or money raised.

The next payment-specific phase should certify payout/disbursement operations, refund administration, finance reconciliation jobs, accounting exports, and fraud/risk monitoring before broad crowdfunding rollout.

# Crowdfunding Payouts — Phase IV

## Objective

Phase IV adds a provider-backed disbursement control plane for donation/reward crowdfunding while preserving VÉRTICE's civic neutrality and fail-closed financial posture.

Collections remain on the existing Mercado Pago rail. Disbursements use a separate Wompi Pagos a Terceros adapter so failures, credentials, webhooks, certification and reconciliation cannot cross provider boundaries.

## Product invariant

Money never changes civic reputation, ranking, verification level, voting weight, organic reach or governance authority. A payout is an accounting/operational state transition only.

## Provider contract

The initial adapter targets the currently operational Wompi Pagos a Terceros v1 bank-account payout contract. BRE-B disbursements are deliberately deferred while Wompi documents that capability as forthcoming.

The adapter uses:

- provider authentication headers (`x-api-key`, `user-principal-id`);
- provider idempotency keys;
- a configured Wompi source account;
- one provider batch per VÉRTICE payout request;
- one beneficiary transaction per MVP payout batch;
- provider-side batch/transaction queries for authoritative state;
- signed Wompi event notifications as reconciliation triggers.

## Data minimization

Beneficiary bank destination fields are accepted only by the privileged payout request endpoint and are passed directly to the provider-bound request. VÉRTICE does **not** persist:

- bank account number;
- beneficiary legal ID;
- beneficiary name;
- beneficiary email;
- raw payout webhook payload;
- provider API secrets.

VÉRTICE persists only a keyed HMAC destination fingerprint, bank provider identifier, account type, provider payout/transaction references, amount, operational status and sanitized failure/status metadata. `PAYOUT_DESTINATION_PEPPER` is a dedicated cryptographic domain and must not reuse `JWT_SECRET`.

## Eligibility gate

A payout request is rejected unless all conditions hold:

1. `CROWDFUNDING_PAYOUTS_ENABLED=true` and the Wompi payout adapter configuration is complete.
2. The latest `wompi_payouts` operational certification is `verified` and carries an external evidence reference.
3. The campaign has verified compliance.
4. The campaign is funded. An active campaign is moved to `funded` only after its goal is reached or its configured end date has passed.
5. No campaign contribution/payment remains pending reconciliation.
6. The campaign beneficiary has a verified and eligible payout profile.
7. No open/escalated financial risk flag exists for the campaign or beneficiary.
8. There is positive reconciled balance available.

The disbursable balance is calculated from `crowdfunding_contributions.status='paid'` and excludes platform tips. Already paid payouts are subtracted.

## Payout lifecycle

Local payout states:

`requested -> pending_approval -> processing -> paid`

Exceptional states:

`failed | not_approved | cancelled | reconciliation_required`

A provider creation response never marks a payout `paid`. VÉRTICE re-fetches the payout batch and its transaction from Wompi. Only an `APPROVED` provider transaction establishes `paid` locally. A provider batch that claims total/partial payment without a conclusive transaction remains `reconciliation_required`.

A stale provider read cannot move a terminal local state back to an in-flight state, and a previously paid payout cannot be resurrected as failed/pending by an out-of-order event.

## Dual control

Wompi's preparer/approver model is part of the operational design. VÉRTICE can prepare a payout request; provider-side approval remains an independent control and is not bypassed by the application. `PENDING_APPROVAL` is therefore an expected healthy state, not a failure.

Phase IV does not implement automatic payouts. Every initial payout request is admin-triggered and production enablement remains explicit.

## Webhooks

Endpoint:

`POST /billing/webhooks/wompi-payouts`

The endpoint does not rely on a VÉRTICE browser/session token. It verifies Wompi's event checksum using the exact property paths and order declared in `signature.properties`, the event timestamp and the configured event secret. Event keys are deduplicated before processing.

The signed event is only a trigger. After signature verification VÉRTICE performs a fresh server-to-server provider query and applies only that authoritative state to the payout ledger. Raw webhook bodies are not stored.

## Admin control plane

All payout execution/control endpoints remain under the existing live admin/superadmin session boundary:

- `GET /billing/admin/finance/payouts/status`
- `GET /billing/admin/finance/payouts`
- `POST /billing/admin/finance/payouts/campaigns/:campaignId`
- `POST /billing/admin/finance/payouts/:payoutRequestId/reconcile`
- `POST /billing/admin/finance/payouts/:payoutRequestId/reconcile/enqueue`
- `POST /billing/admin/finance/payout-certification`

The create endpoint requires a provider-compatible `Idempotency-Key`. Durable reconciliation is available through the existing Postgres job worker and retries with bounded exponential backoff.

## Configuration

Feature-scoped variables:

```text
WOMPI_PAYOUTS_ENV=sandbox|production
WOMPI_PAYOUTS_API_KEY=
WOMPI_PAYOUTS_USER_PRINCIPAL_ID=
WOMPI_PAYOUTS_SOURCE_ACCOUNT_ID=
WOMPI_PAYOUTS_EVENT_SECRET=
PAYOUT_DESTINATION_PEPPER=
CROWDFUNDING_PAYOUTS_ENABLED=false
```

Missing or partial payout configuration never prevents the civic API from booting. `/health/ready` reports `payouts` and `crowdfunding_payouts` as `ready`, `disabled` or `misconfigured` without exposing secret values.

## Sandbox certification sequence

1. Activate Wompi Pagos a Terceros Sandbox for the merchant.
2. Provision API key, user principal and source account identifiers in the API environment.
3. Configure the Wompi event URL to the public `/billing/webhooks/wompi-payouts` endpoint and provision the event secret.
4. Configure a dedicated `PAYOUT_DESTINATION_PEPPER`.
5. Keep `CROWDFUNDING_PAYOUTS_ENABLED=false` while connectivity/signature tests are executed.
6. Verify provider health, idempotent creation, duplicate event handling and payout/transaction queries.
7. Validate preparer/approver separation with a sandbox payout that reaches `PENDING_APPROVAL`, then approved/failed terminal paths.
8. Record the external evidence through `/billing/admin/finance/payout-certification` with status `verified`.
9. Enable the payout feature only in the environment being certified.
10. Execute a bounded canary against a test campaign and reconcile until a provider terminal state is obtained.

## Production gate

Do not enable production payout execution merely because the code is merged. Before `CROWDFUNDING_PAYOUTS_ENABLED=true` in production, operators must confirm:

- Wompi Pagos a Terceros is activated for the production merchant;
- the correct production source account and limits are known;
- preparer and approver responsibilities are assigned to distinct authorized operators;
- the production webhook secret and callback are validated;
- sandbox canaries passed for pending approval, approved, failed, duplicate webhook and provider-timeout scenarios;
- the latest `wompi_payouts` certification is `verified` with external evidence;
- no unresolved financial-risk alert affects the production canary campaign/beneficiary;
- production starts with a small controlled canary before broader crowdfunding payout availability.

## Deferred

- BRE-B payout execution, until the provider capability is generally available and separately certified.
- automatic or scheduled payouts.
- split payouts / multiple beneficiaries per campaign.
- partial payouts / milestone releases.
- payout reversal automation.
- investment, securities, profit-share or electoral crowdfunding.

Those capabilities require separate policy, accounting, compliance and provider certification phases.

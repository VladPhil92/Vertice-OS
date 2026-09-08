# Crowdfunding Payouts — Phase IV

## Objective

Phase IV adds a provider-backed disbursement control plane for donation/reward crowdfunding while preserving VÉRTICE's civic neutrality and fail-closed financial posture.

Collections remain on the existing Mercado Pago rail. Disbursements use a separate Wompi Pagos a Terceros adapter so failures, credentials, webhooks, certification and reconciliation cannot cross provider boundaries.

## Product invariant

Money never changes civic reputation, ranking, verification level, voting weight, organic reach or governance authority. A payout is an accounting/operational state transition only.

## Provider contract

The Phase IV adapter targets Wompi Pagos a Terceros **API v2 with BRE-B destinations**. Wompi currently documents sandbox key resolution, beneficiary preview and payout creation through BRE-B keys. This is preferred over traditional bank-account input because the payout can be addressed without VÉRTICE receiving or persisting the beneficiary's account number, bank or legal document.

The adapter uses:

- provider authentication headers (`x-api-key`, `user-principal-id`);
- `business-application-id: WOMPI_PAYOUTS` for the v2 integration;
- provider idempotency keys;
- a configured Wompi source account;
- `GET /v2/breb/keys/resolve/{key}` before execution;
- `POST /v2/payouts` for the payout batch;
- one provider batch per VÉRTICE payout request;
- one beneficiary transaction per MVP payout batch;
- provider-side batch/transaction queries for authoritative state;
- signed Wompi event notifications as reconciliation triggers.

## Data minimization

The BRE-B key, beneficiary notification name/email and preview confirmation fields are accepted only by privileged endpoints and passed through the provider-bound flow. VÉRTICE does **not** persist:

- BRE-B key value;
- bank account number;
- bank destination;
- beneficiary legal ID;
- beneficiary name;
- beneficiary email;
- raw payout webhook payload;
- provider API secrets.

VÉRTICE persists only a keyed HMAC destination fingerprint, BRE-B key type, provider payout/transaction references, amount, operational status and sanitized failure/status metadata. `PAYOUT_DESTINATION_PEPPER` is a dedicated cryptographic domain and must not reuse `JWT_SECRET`.

The same fingerprint shape is stored twice, for two different purposes: on `crowdfunding_payout_requests` (the destination used for one specific payout) and on `crowdfunding_payout_profiles` (the destination the beneficiary has registered as their own — see below). A payout request's fingerprint must match the profile's registered fingerprint before money moves.

## Beneficiary preview and confirmation

**The beneficiary — never an admin — is the only actor who can bind a BRE-B destination to their own payout profile.** An admin can request a payout, but only ever to whatever destination the beneficiary already resolved and confirmed themselves:

1. `POST /crowdfunding/me/payout-destination/preview` (self-service, `requireVerified`) resolves a BRE-B key against Wompi and returns the provider's masked holder name, financial entity, key type and masked key value. The preview is not persisted.
2. `POST /crowdfunding/me/payout-destination` (self-service) has the beneficiary confirm that masked holder name + financial-entity code. VÉRTICE re-resolves the key server-to-server, requires an exact match, and — only then — stores a keyed HMAC fingerprint of that destination on the beneficiary's `crowdfunding_payout_profiles` row.

The admin-facing payout request is then a second, independent confirmation of the *same* provider identity, not the source of truth for *whose* destination it is:

3. `POST /billing/admin/finance/payouts/destinations/preview` resolves the BRE-B key against Wompi the same way, for the admin to see before requesting a payout.
4. The admin sends the masked holder name + financial-entity code back with the payout request. VÉRTICE resolves the key again server-to-server and requires an exact match with that confirmation — **and** requires the resulting destination fingerprint to match the beneficiary's own registered one (step 2). A mismatch — including no registered destination at all — fails closed with `PAYOUT_DESTINATION_NOT_VERIFIED` before any payout ledger row or provider payment instruction is created.

This closes a fund-diversion gap in the original design: previously an admin's confirmation was only checked against Wompi's resolution of whatever key the admin typed, never against the beneficiary's own verified destination, so any admin session could redirect a payout to an arbitrary BRE-B key as long as the beneficiary had *some* verified payout profile.

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
9. The BRE-B destination has just been re-resolved and matches the admin's preview confirmation.
10. That same destination's fingerprint matches the one the beneficiary registered themselves via `POST /crowdfunding/me/payout-destination`.

The disbursable balance is calculated from `crowdfunding_contributions.status='paid'` and excludes platform tips. Already paid payouts are subtracted.

## Payout lifecycle

Local payout states:

`requested -> pending_approval -> processing -> paid`

Exceptional states:

`failed | not_approved | cancelled | reconciliation_required`

A provider creation response never marks a payout `paid`. VÉRTICE re-fetches the payout batch and its transaction from Wompi. Only an `APPROVED` provider transaction establishes `paid` locally. A provider batch that claims total/partial payment without a conclusive transaction remains `reconciliation_required`.

A stale provider read cannot move a terminal local state back to an in-flight state, and a previously paid payout cannot be resurrected as failed/pending by an out-of-order event.

Two related correctness properties:

- **`failed` means definitively no money moved.** Only a failure in the submission call itself (before a provider payout batch exists) can be classified `failed`. Any failure once the provider has accepted the submission — a lookup error, a ledger mismatch, a transient fault while syncing — stays `reconciliation_required`, since `failed` is excluded from the one-active-payout-per-campaign lock and a second request could otherwise create a duplicate disbursement.
- **A `requested` row that never reached the provider is retried, not replayed.** The idempotency key lookup only treats a prior row as a completed replay when its status shows the provider was actually contacted. A row stuck at `requested` (e.g. a crash between the local insert and the provider call) resumes submission on the next request with the same key instead of returning an unsubmitted result forever.

## Dual control

Wompi's preparer/approver model is part of the operational design. VÉRTICE can prepare a payout request; provider-side approval remains an independent control and is not bypassed by the application. `PENDING_APPROVAL` is therefore an expected healthy state, not a failure.

Phase IV does not implement automatic payouts. Every initial payout request is admin-triggered and production enablement remains explicit.

## Webhooks

Endpoint:

`POST /billing/webhooks/wompi-payouts`

The endpoint does not rely on a VÉRTICE browser/session token. It verifies Wompi's event checksum using the exact property paths and order declared in `signature.properties`, the event timestamp and the configured event secret. Event keys are deduplicated before processing.

The signed event is only a trigger. After signature verification VÉRTICE performs a fresh server-to-server provider query and applies only that authoritative state to the payout ledger. Raw webhook bodies are not stored.

Event deduplication distinguishes a true duplicate from a delivery worth retrying: a prior delivery of the exact same signed event that ended `failed` is reset and reprocessed, since otherwise a single processing failure would permanently strand that event's reconciliation. Any other prior state (`received`, `processed`, `ignored`) is left untouched.

## Self-service beneficiary endpoints

These are citizen-facing, not admin-facing, and require only `requireVerified`:

- `POST /crowdfunding/me/payout-destination/preview`
- `POST /crowdfunding/me/payout-destination`

Registration requires an existing payout profile row (from `POST /crowdfunding/me/payout-readiness/request-review`); it does not itself grant `verified`/`eligible` status, which still requires admin KYC/KYB review.

## Admin control plane

All payout execution/control endpoints remain under the existing live admin/superadmin session boundary:

- `GET /billing/admin/finance/payouts/status`
- `GET /billing/admin/finance/payouts`
- `POST /billing/admin/finance/payouts/destinations/preview`
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
6. Verify BRE-B key resolution and confirm that VÉRTICE exposes only Wompi's masked preview.
7. Verify provider idempotency, duplicate event handling and payout/transaction queries.
8. Validate preparer/approver separation with a sandbox payout that reaches `PENDING_APPROVAL`, then approved/failed terminal paths.
9. Record the external evidence through `/billing/admin/finance/payout-certification` with status `verified`.
10. Enable the payout feature only in the environment being certified.
11. Execute a bounded canary against a test campaign and reconcile until a provider terminal state is obtained.

## Production gate

Do not enable production payout execution merely because the code is merged. Before `CROWDFUNDING_PAYOUTS_ENABLED=true` in production, operators must confirm:

- Wompi Pagos a Terceros is activated for the production merchant;
- production API v2/BRE-B is enabled for the account;
- the correct production source account and limits are known;
- preparer and approver responsibilities are assigned to distinct authorized operators;
- the production webhook secret and callback are validated;
- sandbox canaries passed for beneficiary preview/confirmation, pending approval, approved, failed, duplicate webhook and provider-timeout scenarios;
- the latest `wompi_payouts` certification is `verified` with external evidence;
- no unresolved financial-risk alert affects the production canary campaign/beneficiary;
- production starts with a small controlled canary before broader crowdfunding payout availability.

## Deferred

- automatic or scheduled payouts;
- split payouts / multiple beneficiaries per campaign;
- partial payouts / milestone releases;
- payout reversal automation;
- direct bank-account fallback inside VÉRTICE;
- investment, securities, profit-share or electoral crowdfunding.

Those capabilities require separate policy, accounting, compliance and provider certification phases.

# VÉRTICE OS — Finance Operations Phase III

## Objective

Phase III adds the operational control plane required to supervise real money flows before broad crowdfunding activation. It builds on Payment Execution Phase II without changing the core product invariant: money never changes civic reputation, ranking, voting weight, verification, trust, or organic reach.

This phase is deliberately **control-first**. It does not activate automatic payouts and it does not store bank account numbers, cards, payout credentials, or provider-owned KYC documents.

## Capabilities

### 1. Durable reconciliation

Administrators can run provider reconciliation synchronously or enqueue it in the existing durable Postgres job queue.

The reconciliation run records:

- run status;
- trigger type (`manual` or `job`);
- scanned transaction count;
- changed transaction count;
- failed transaction count;
- one item per transaction with before/after status and failure information.

Provider amount and currency must match the local ledger. Unknown states fail closed. Subscription mandate authorization never grants Pro.

### 2. Crowdfunding refund administration

Phase III supports **full refunds for paid crowdfunding Orders** through the provider adapter.

Controls:

- admin-only endpoint;
- local idempotency key;
- provider idempotency key;
- only local `paid` crowdfunding contributions can enter the refund flow;
- provider ambiguity becomes `reconciliation_required` instead of a second refund attempt;
- the local contribution ledger is not marked refunded because VÉRTICE requested a refund;
- VÉRTICE re-fetches the provider Order and only applies a refund after the verified provider resource reports the reversal;
- campaign raised totals are adjusted transactionally and only once.

Subscription refunds, partial refunds, and arbitrary manual ledger edits remain out of scope.

### 3. Finance risk queue

Risk monitoring produces reviewable signals rather than automatic penalties.

Initial deterministic rules:

- chargeback: `critical`;
- crowdfunding contribution of at least COP 2,000,000: `medium`;
- campaign creator funding their own campaign: `medium`;
- at least 5 payment attempts/transactions in 10 minutes: `high`;
- at least 3 failed payments in 24 hours: `medium`.

A risk flag can be reviewed, dismissed, or escalated by an administrator. A flag does **not** change reputation, ranking, civic permissions, or identity verification by itself.

These thresholds are operational defaults for the pilot, not claims of fraud.

### 4. Accounting export

Administrators can export up to 92 days per CSV request. The export contains ledger identifiers and accounting fields, including:

- transaction ID;
- accounting date;
- transaction kind/status;
- provider/provider transaction ID;
- amount, platform fee and currency;
- citizen UUID and campaign UUID when applicable;
- contribution amount and optional VÉRTICE tip.

The export intentionally excludes citizen names, email addresses, bank data, cards, and identity documents.

### 5. Payout-operation certification

Phase III adds an append-only operational certification record for the payout/disbursement process.

States:

- `pending`;
- `verified`;
- `rejected`;
- `suspended`.

A `verified` certification requires an external evidence reference. This certification is evidence that the operational process was reviewed; it **does not enable an automatic transfer API**.

`automaticPayoutsEnabled` remains hard-coded to `false` in the finance operations status response.

## Administrative API

All endpoints require an active live `admin` or `superadmin` role through the existing privileged-session middleware.

```text
GET  /billing/admin/finance/status
POST /billing/admin/finance/reconcile
POST /billing/admin/finance/reconcile/enqueue
POST /billing/admin/finance/risk/scan
GET  /billing/admin/finance/risk?limit=100
POST /billing/admin/finance/risk/:flagId/review
POST /billing/admin/finance/refunds/:transactionId
GET  /billing/admin/finance/export.csv?from=<ISO>&to=<ISO>
POST /billing/admin/finance/payout-certification
```

Sensitive human actions are written to `admin_audit_log` through the existing audit boundary.

## Data model

Phase III introduces operational tables only:

```text
payment_refund_requests
payment_reconciliation_runs
payment_reconciliation_items
payment_risk_flags
payout_operation_certifications
```

No raw payout destination exists in these tables.

## Crowdfunding release gate

Broad monetary crowdfunding should remain disabled until all of the following are true:

1. provider production credentials and signed webhooks are configured;
2. a low-value Pro canary verifies authorization -> approved charge -> entitlement -> cancellation/reconciliation;
3. KYC/KYB and campaign compliance operations are certified;
4. finance reconciliation runs successfully against production provider resources;
5. refund canary completes and reconciles correctly;
6. risk queue and accounting export are reviewed operationally;
7. payout/disbursement procedure receives a `verified` certification with external evidence;
8. a separate payout adapter phase is implemented and certified if VÉRTICE will initiate transfers directly.

Until then, `CROWDFUNDING_PAYMENTS_ENABLED=false` remains the safe default.

## Explicitly out of scope

- automatic payouts or bank transfers;
- bank-account/card storage;
- partial crowdfunding refunds;
- subscription refund administration;
- investment, debt, equity, profit-share or token crowdfunding;
- political/electoral campaign financing;
- automatic account punishment from a risk signal;
- any paid influence over reputation, ranking, trust, verification, voting, or organic reach.

## Next phase

After Phase III passes CI and operational canaries, the next payment-specific phase is a separately certified **payout/disbursement adapter** with beneficiary ownership verification, provider-side destination references, transfer idempotency, payout reconciliation, failure recovery, and explicit release controls. It must preserve the no-raw-bank-data boundary whenever the provider supports hosted/managed beneficiary onboarding.

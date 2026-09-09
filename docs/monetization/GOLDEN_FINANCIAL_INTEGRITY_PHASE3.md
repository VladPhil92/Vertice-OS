# Golden Financial Integrity — Phase 3

Execution date: 2026-09-08

## Objective

Move VÉRTICE OS from a financially feature-complete codebase to an internally certifiable money ledger before any production provider activation.

The repository already contains Mercado Pago collection, reconciliation/refunds/risk controls, Wompi BRE-B payout execution, beneficiary destination binding, flexible/milestone payout policy, and crowdfunding readiness gates. Phase 3 therefore does not add a parallel payment stack. It adds a deterministic, real-Postgres certification layer across those existing boundaries.

## Golden contracts

### GF-01 — Fee snapshot and checkout idempotency

A real crowdfunding checkout is created through the canonical service while the external Mercado Pago HTTP boundary is replaced with a synthetic deterministic provider contract.

The database trigger must snapshot the fee policy at insertion time:

- verified social/emergency donation: 100 bps (1.00%);
- standard donation: 250 bps (2.50%);
- reward/prepurchase: 350 bps (3.50%).

The optional platform tip is excluded from the fee base. The transaction metadata must persist `platform_fee_bps`, `platform_fee_policy_version`, and `platform_fee_base_cop`. Replaying the same citizen/kind/idempotency key must return the existing checkout and must not create a second provider order.

### GF-02 — Provider-verified settlement and reversal

The synthetic provider returns an order only after the signed webhook contract has been validated by the production Mercado Pago adapter code.

The journey proves:

1. a processed order changes a pending contribution to paid;
2. only contribution principal increases `raised_amount_cop` — optional tip does not;
3. duplicate delivery of the same provider event does not double-count;
4. a later provider-refetched refund reverses the paid contribution exactly once;
5. duplicate refund delivery does not make the campaign balance negative.

A browser redirect is never payment evidence in this journey.

### GF-03 — Disbursable balance integrity

The payout balance is reconstructed from settled contribution rows and payment transactions using the same invariant as the flexible payout service:

`net paid principal = SUM(contribution principal - immutable platform fee)`

Then prior successful payouts are deducted. Platform tips are not beneficiary balance. All-or-nothing campaigns remain ineligible until the contribution goal has been reached.

### GF-04 — Civic neutrality and fail-closed payout readiness

After checkout, settlement, refund and payout ledger activity:

- citizen reputation scores must be unchanged;
- no `reputation_events` may be created by money movement;
- payout execution remains blocked when the Wompi/BRE-B rail is not configured/enabled/certified.

## Schema evidence

The CI job starts from the historical `infrastructure/db/init.sql` baseline and applies the exact financial slices required by current runtime contracts, in order:

1. `20260907234500_monetization_foundation`
2. `20260908023500_payment_execution_phase2`
3. `20260908113000_finance_operations_phase3`
4. `20260908121500_crowdfunding_payouts_phase4`
5. `20260908140500_crowdfunding_payout_destination_binding`
6. `20260908143000_crowdfunding_category_policy_alignment`
7. `20260908145000_crowdfunding_fee_funding_policy_phase5`

This is intentionally a real PostgreSQL/PostGIS database. Fee triggers, constraints, unique indexes, transactions and ledger queries are therefore exercised rather than mocked.

## Certification boundary

A green `Golden Financial Integrity` check means:

- fee policy is **INTEGRATED** with the database ledger;
- internal contribution settlement/reversal integrity is **INTEGRATED**;
- payout-balance mathematics is **INTEGRATED**;
- civic/financial separation is **INTEGRATED**.

It does **not** mean the following are certified:

- Mercado Pago production credentials or live merchant account;
- Mercado Pago real checkout/settlement/refund canaries;
- Wompi Pagos a Terceros / BRE-B production credentials;
- real beneficiary resolution or payout execution;
- bank settlement and accounting reconciliation outside VÉRTICE;
- regulatory/KYC/KYB approval.

Those require external provider and operational evidence and must remain `BLOCKED`, `IMPLEMENTED`, or `INTEGRATED` until a real canary is recorded.

## Safety invariants

- Money never changes reputation, ranking, voting weight, identity assurance, civic authority or organic reach.
- Provider redirect/client state is not payment evidence.
- Platform fee is an immutable ledger snapshot deducted from principal.
- Optional tips are separate from campaign principal and beneficiary balance.
- Duplicate provider events cannot double-count funds.
- Refund/chargeback transitions cannot resurrect or double-reverse money.
- Payout eligibility is based on settled net balance, funding policy, risk/compliance state and verified beneficiary configuration.
- Payout execution is fail-closed unless provider configuration, feature flag and operational certification all pass.

## Definition of done

Phase 3 internal certification is code-complete only when:

- Golden Financial Integrity is green on the exact PR head SHA;
- monorepo CI, SAST and Golden Main remain green;
- existing Golden E2E journeys remain green;
- no P1/P2 review thread remains unresolved;
- the PR is synchronized with current `main` before merge.

External payment/payout provider certification is a separate release milestone and cannot be inferred from this phase.

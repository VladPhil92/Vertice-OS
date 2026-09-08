# VÉRTICE OS — Crowdfunding Fee & Funding Policy Phase V

## Objective

Phase V converts crowdfunding pricing and withdrawal flexibility into enforceable product and database policy.

The governing principle is:

> VÉRTICE charges transparently for infrastructure, never for civic influence, and does not hold settled campaign funds merely because a public fundraising goal has not yet been reached.

Money remains fully separated from civic reputation, ranking, verification, voting weight and organic reach.

## Canonical platform commission

The platform fee is calculated on **contribution principal only**. Optional VÉRTICE tips are excluded from the fee base.

| Campaign class | VÉRTICE platform fee |
| --- | ---: |
| Verified social cause or verified emergency | **1.00%** |
| Donation, community, cultural, educational, civic and other standard donation campaigns | **2.50%** |
| Reward / prepurchase campaigns | **3.50%** |

Implementation uses integer basis points:

- social/emergency verified: `100 bps`;
- standard donation: `250 bps`;
- reward/prepurchase: `350 bps`.

The current policy snapshot version is `2026-09-v1`.

### Fee semantics

- the donor selects a contribution principal;
- an optional platform tip remains independently selectable and may be COP 0;
- VÉRTICE does **not** add its platform fee as a hidden surcharge above the selected contribution;
- the platform fee is deducted from campaign principal when computing disbursable balance;
- payment-provider processing costs are a separate operational cost and must never be represented as VÉRTICE platform commission;
- every new crowdfunding payment transaction stores an immutable fee snapshot in `platform_fee_cop` and metadata (`platform_fee_bps`, policy version and fee base).

A PostgreSQL `BEFORE INSERT` trigger enforces the canonical fee even if an application client or service attempts to submit `platform_fee_cop=0`.

## Funding policies

Campaigns now have an explicit `funding_policy`:

### `flexible`

Default for donation campaigns.

A compliant active campaign may withdraw its positive settled balance while fundraising is still open. Reaching the public goal is **not** a payout prerequisite.

Example:

- goal: COP 5,000,000;
- paid/reconciled principal after VÉRTICE fee: COP 390,000;
- previous paid payouts: COP 0;
- disbursable balance: COP 390,000.

Pending contributions do not freeze already settled money. They simply do not enter the available-balance calculation until paid and reconciled.

### `all_or_nothing`

Default for reward and prepurchase campaigns.

No payout is permitted until `raised_amount_cop >= goal_amount_cop`. Once the goal is reached, an active campaign may transition to `funded` and begin disbursement/execution.

Reward/prepurchase campaigns cannot opt into `flexible`.

### `milestone`

Used when staged accountability is preferable to either unrestricted flexible withdrawals or a single all-or-nothing release.

Disbursable balance is capped by the cumulative `target_amount_cop` of verified milestones, less amounts already paid out.

Therefore:

`available = min(settled net balance, verified milestone capacity remaining)`

A milestone campaign with no verified monetary milestone has no payout capacity even if it has received paid contributions.

## Settled-balance accounting

The payout service now computes campaign net paid balance as:

`paid contribution principal - VÉRTICE platform fee - prior paid payouts`

Optional platform tips are not campaign principal and are never included in payout balance.

The service no longer blocks all payouts merely because another contribution remains pending. Only `paid` contribution rows backed by `paid` payment transactions enter the disbursable calculation.

## Repeated withdrawals

Phase IV allowed only one active/successful payout lifecycle per campaign. Phase V changes that rule:

- at most one **in-flight** payout per campaign remains allowed;
- `requested`, `pending_approval`, `processing` and `reconciliation_required` block a concurrent second payout;
- a completed `paid` payout no longer prevents a later withdrawal when new settled balance becomes available.

Provider idempotency, reconciliation and beneficiary re-resolution remain mandatory for every payout.

## Safety controls preserved

Flexible funding does not weaken financial controls. A payout still requires:

- payout feature enabled;
- Wompi payout rail configured;
- current payout-operation certification verified;
- campaign compliance verified;
- verified and eligible beneficiary payout profile;
- no open/escalated campaign or beneficiary financial-risk flag;
- fresh BRE-B destination resolution matching the administrator confirmation;
- positive policy-eligible settled balance;
- provider reconciliation before local `paid` status.

Raw bank account numbers, legal IDs, beneficiary names/emails and BRE-B key values remain outside durable VÉRTICE payout storage.

## Public API contract

`GET /crowdfunding/config` now exposes:

- `fundingPolicies`;
- `feePolicy`;
- updated guardrails describing flexible withdrawals and reward all-or-nothing defaults.

Campaign creation accepts optional `funding_policy`. If omitted:

- `donation` -> `flexible`;
- `reward` -> `all_or_nothing`.

## Production migration

Apply, in order:

1. `apps/api/prisma/migrations/20260908143000_crowdfunding_category_policy_alignment/migration.sql` — introduces the `funding_policy` column, its value/category constraints and the reward-cannot-be-flexible rule.
2. `apps/api/prisma/migrations/20260908145000_crowdfunding_fee_funding_policy_phase5/migration.sql` — adds the funding-policy index, the flexible-payout in-flight index and canonical platform-fee enforcement.

before enabling campaign checkout/payout traffic built against Phase V.

## Invariants

- platform pricing never changes civic reputation or influence;
- fee rate is determined server-side and enforced in PostgreSQL;
- social/emergency 1% requires verified campaign compliance;
- tips remain optional and separate;
- no hidden withdrawal penalty is introduced by VÉRTICE;
- flexible funding releases only settled net balance, never pending money;
- all-or-nothing campaigns cannot withdraw below goal;
- milestone campaigns cannot exceed verified milestone capacity;
- only one payout may be in flight per campaign at a time.

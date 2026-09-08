# Crowdfunding Campaign Lifecycle — Phase VII

## Objective

Make crowdfunding campaigns operationally reviewable without weakening the financial or civic safety boundaries established in earlier phases.

This phase governs the campaign lifecycle only. It does **not** enable payment rails, crypto transfers, automatic payouts, or financial influence over civic reputation.

## Canonical lifecycle

```text
draft
  -> review / in_review
      -> verified / verified
          -> active
      -> draft / pending          (request_changes)
      -> review / rejected        (hard reject)
      -> suspended / suspended
```

The database prevents these unsafe skips:

- `draft -> verified|active|funded|executing|verifying|completed`
- `review -> active|funded|executing|verifying|completed`
- `verified -> funded|executing|verifying|completed`

Activation still uses the existing readiness service and requires a verified/eligible payout profile. The successful `verified -> active` transition is recorded by a database trigger in the lifecycle ledger.

## Creator workflow

Dashboard routes:

- `/dashboard/crowdfunding` — operational crowdfunding center
- `/dashboard/crowdfunding/new` — category-first campaign creation
- `/dashboard/crowdfunding/manage` — creator campaign portfolio
- `/dashboard/crowdfunding/:campaignId` — campaign lifecycle workspace

A creator may:

1. create a draft;
2. edit only while the campaign is in `draft`;
3. review the canonical category, funding model, funding policy, target and budget;
4. formally submit the campaign for compliance review;
5. see review notes and lifecycle history;
6. edit and resubmit if changes are requested;
7. activate only after campaign approval and financial readiness.

Submitting a campaign locks normal editing while it is under review.

## Administrative workflow

Dashboard routes:

- `/dashboard/admin/crowdfunding` — existing compliance/readiness operations
- `/dashboard/admin/crowdfunding/lifecycle` — formal campaign review queue
- `/dashboard/admin/crowdfunding/lifecycle/:campaignId` — full review dossier

Only campaigns in `status=review` and `compliance_status=in_review` appear in the canonical review queue.

The full dossier exposes the campaign plan, funding model/policy, target, budget, territory, creator reference and lifecycle history before a decision is made.

Review decisions:

- `approve` -> `verified / verified`
- `request_changes` -> `draft / pending`
- `reject` -> `review / rejected`
- `suspend` -> `suspended / suspended`

`request_changes`, `reject` and `suspend` require documented notes. The canonical lifecycle review mutation is idempotent and admin-only.

## API

Creator:

- `GET /crowdfunding/me/campaigns/:campaignId`
- `PUT /crowdfunding/me/campaigns/:campaignId`
- `POST /crowdfunding/me/campaigns/:campaignId/submit-review`
- existing `POST /crowdfunding/me/campaigns/:campaignId/activate`

Administration:

- `GET /crowdfunding/admin/lifecycle/campaigns/:campaignId`
- `POST /crowdfunding/admin/lifecycle/campaigns/:campaignId/review`

Legacy compliance review remains available for compatibility but now also requires formal `review/in_review` state before approve/reject, preventing a direct draft approval.

## Audit ledger

`crowdfunding_campaign_lifecycle_events` stores append-only operational evidence for:

- draft creation;
- draft updates;
- submission;
- requested changes;
- hard rejection;
- approval;
- activation;
- suspension.

Each record includes campaign, actor when known, revision number, before/after state, notes and timestamp.

## Security invariants

- A draft cannot become public without formal review.
- A browser redirect or UI state is never financial settlement evidence.
- Campaign approval does not move funds.
- Campaign activation does not bypass payment-provider feature flags.
- Donations, subscription status and amount raised do not alter civic reputation, rank, voting weight, verification or organic reach.
- Investment-like crowdfunding remains prohibited: equity, debt, profit share, revenue share and token sale.
- CTG One / CTG Wallet remain the financial authority for shared fiat/crypto settlement infrastructure; this lifecycle stays in VÉRTICE as the civic campaign authority.

## Next gate

Phase VIII should make campaign compliance/readiness self-service and explicit in the creator journey, then certify real collection end-to-end only after provider, ledger and reconciliation gates are green.

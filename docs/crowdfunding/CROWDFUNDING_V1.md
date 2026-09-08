# VÉRTICE Causas — Crowdfunding v1

## Purpose

Crowdfunding closes the civic-action loop:

`problem → initiative → community → funding → execution → evidence → impact`

The first version is designed for social, cultural, community and city projects. It is **not** an investment platform.

## Allowed funding models

- `donation`
- `reward`

The API schema and database constraint both reject investment-like models.

## Explicitly prohibited in v1

- equity / ownership participation;
- debt / loans;
- profit sharing;
- revenue sharing;
- token sales or tokenized investment promises;
- political or electoral campaign finance.

These exclusions are product and compliance boundaries, not merely UI copy.

## Categories

- social;
- community;
- culture;
- education;
- environment;
- animal welfare;
- sports;
- public space;
- civic technology;
- social entrepreneurship;
- heritage.

## Campaign lifecycle

1. `draft`
2. `review`
3. `verified`
4. `active`
5. `funded`
6. `executing`
7. `verifying`
8. `completed`

Exceptional states:

- `suspended`
- `investigation`

Creating a campaign only produces `draft` + `compliance_status=pending`.

A database constraint prevents a campaign from entering a public lifecycle state unless `compliance_status=verified`.

## Compliance lifecycle

- `pending`
- `in_review`
- `verified`
- `rejected`
- `suspended`

The future activation workflow must verify the campaign creator and payout destination before accepting money.

## Campaign data model

A campaign stores:

- creator;
- title/slug;
- public summary and description;
- category;
- funding model;
- goal and amount raised in COP;
- territory (locality/neighborhood);
- itemized budget;
- campaign/compliance status;
- schedule;
- review notes.

Supporting tables provide:

- `crowdfunding_contributions` — donor/payment link;
- `crowdfunding_milestones` — execution checkpoints and evidence;
- `crowdfunding_updates` — public execution/transparency updates;
- `payment_transactions` — provider-neutral payment ledger.

## API foundation

### `GET /crowdfunding/config`

Public categories, allowed funding models, statuses and guardrails.

### `GET /crowdfunding/campaigns`

Public catalog. Only compliance-verified campaigns in public statuses are returned.

### `POST /crowdfunding/campaigns`

Authenticated creation of a draft. The request validates title, summary, description, category, funding model, goal, territory and itemized budget.

Budget validation prevents the submitted budget from exceeding the requested funding goal.

### `GET /crowdfunding/me/campaigns`

Authenticated owner view, including drafts and campaigns under review.

### `GET /crowdfunding/me/analytics`

Pro-only aggregate campaign analytics. This endpoint is the first concrete monetization feature gate.

## Reputation neutrality

Crowdfunding money is not a civic-performance signal.

Therefore:

- contribution amount grants zero reputation points;
- total amount raised grants zero reputation points;
- sponsorship grants zero reputation points;
- financial success never changes voting weight;
- a small, verified community project can outperform a large campaign in civic reputation if its execution and evidence are better.

Any future reputation impact from a campaign must come from independently verified execution milestones and the existing civic-evidence system.

## Payment safety requirements before contributions go live

The contribution checkout remains intentionally disabled until the payment phase implements:

1. selected payment provider;
2. signed webhook verification;
3. event idempotency;
4. transaction reconciliation;
5. refund/chargeback handling;
6. creator KYC/KYB policy;
7. payout-account ownership verification;
8. campaign risk/review tooling;
9. transparent fee disclosure;
10. operational incident and suspension procedures.

## Next slice

The next crowdfunding phase should add creator compliance review, admin moderation, public campaign detail UI, milestones/updates UI and provider-backed contributions. Payment activation should happen only after the subscription provider adapter and webhook pipeline are proven.

# P0 — Civic Identity Assurance

## Objective

VÉRTICE separates three concepts that must never be treated as equivalent:

1. **Authentication** — the user controls a VÉRTICE/CTG One session.
2. **Contact verification** — the user controls the declared email/contact channel.
3. **Civic identity assurance** — an independently trusted provider has performed identity proofing strong enough for a civic-governance action.

The legacy `verification_level` remains useful for onboarding, but it is not proof that the declared Colombian identity belongs to the person operating the account.

## P0.2 trust contract

VÉRTICE uses the durable `external_identities` mapping as the attachment point for identity providers, with an explicit policy boundary:

- only provider identifiers listed in `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` are accepted as civic identity evidence when a **new voter roll is frozen**;
- the allowlist is empty by default, so future protected electorates fail closed until an audited provider is configured;
- the canonical CTG One federation key is `ctg_one`, and ordinary CTG One federation is **not** implicitly civic assurance;
- a citizen entering a new voter roll also needs `verification_level >= 2`, so verified contact remains a prerequisite;
- `/identity/assurance` exposes current onboarding state without relabeling email, wallet, account federation or self-declared document checks as KYC.

When a proposal enters `voting`, `proposal_voter_roll` becomes the immutable authorization snapshot for that voting window. The vote path does **not** re-evaluate the live provider allowlist after the roll has been frozen. A provider-policy change therefore applies to future voter rolls and cannot retroactively alter an open electorate while leaving its quorum denominator unchanged.

## Liquid-democracy invariant

Direct and delegated participation use the same frozen electorate and the same durable `votes` ledger. Each citizen is represented by a proposal-scoped HMAC nullifier rather than a stored `citizen_id` on the ballot row.

A delegation can contribute only when the delegator belongs to `proposal_voter_roll`, the delegation is active, its validity window is open and its scope applies to the proposal.

Overlapping scopes resolve deterministically **before** selecting the delegate who receives the vote:

1. proposal-specific delegation;
2. matching domain delegation;
3. general delegation.

Within the same specificity level, the newest delegation wins. This prevents a general delegate from claiming a citizen before that citizen's more-specific delegate votes and guarantees at most one effective delegated choice per citizen and proposal.

A delegated choice is persisted as a normal vote-ledger row with `is_delegated = true`. If the citizen later votes personally, that same nullifier row is converted to a direct vote instead of creating a second participant. The direct choice therefore overrides delegation without changing the number of participants.

Proposal tallies are rebuilt from the durable ledger inside the same transaction as the direct vote and delegated claims. `proposals.total_votes` consequently counts durable participant rows, including delegated participants, so the quorum numerator is aligned with the frozen electorate denominator. Rebuilding from the indexed ledger is intentionally preferred over incremental counters until production volume demonstrates a measured need for a more complex tally architecture.

## Provider onboarding rule

A provider must not be added to the assurance allowlist until the integration guarantees that its `external_identities` row is created only after successful identity proofing. SSO, email matching, wallet ownership, account age, civic reputation or possession of a CTG One account are insufficient by themselves.

For a Cartagena pilot, the selected provider should be evaluated for, at minimum:

- government-issued document verification appropriate to Colombia;
- anti-spoofing/liveness or equivalent person-presence control where applicable;
- duplicate-person resistance;
- auditable verification outcome and provider reference;
- revocation and review path;
- data-minimization and retention controls compatible with Colombian data-protection obligations;
- operational availability and incident response.

## Remaining maturity work

This phase establishes the trust boundary and a consistent frozen electorate, but does not claim full identity maturity. Follow-up phases should:

1. integrate the selected production identity provider and signed callback/webhook contract;
2. persist assurance lifecycle metadata (`verified`, `revoked`, `expired`, `review`) independently from generic federation links;
3. extend assurance requirements to proposal creation and endorsement according to governance policy;
4. add administrative review, revocation, reconciliation and audit evidence;
5. expose actionable assurance onboarding in the citizen dashboard.

## Security invariant

**No code path may infer general civic identity assurance merely from login, matching email, CTG One federation, self-declared cédula, wallet signature, reputation score or historical voter-roll membership.** Membership in a frozen roll authorizes participation only in that proposal's voting window; it is not reusable assurance evidence elsewhere.

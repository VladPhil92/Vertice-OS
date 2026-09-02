# P0 — Civic Identity Assurance

## Objective

Separate three concepts that must never be treated as equivalent in VÉRTICE OS:

1. **Authentication** — the user controls a VÉRTICE/CTG One session.
2. **Contact verification** — the user controls the declared email/contact channel.
3. **Civic identity assurance** — an independently trusted provider has performed identity proofing strong enough for a civic-governance action.

The legacy `verification_level` remains useful for onboarding, but it is not proof that the declared Colombian identity belongs to the person operating the account.

## P0.1 trust contract

VÉRTICE reuses the durable `external_identities` mapping as the attachment point for identity providers, with one additional policy boundary:

- only provider identifiers listed in `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` are accepted as civic identity evidence;
- the allowlist is empty by default;
- empty allowlist means **fail-closed** for protected governance actions;
- `ctgone` federation is **not** implicitly an assurance provider;
- a citizen also needs `verification_level >= 2` so contact verification remains a prerequisite;
- `/identity/assurance` exposes the actual state without relabeling declared-document or email checks as KYC.

The first protected high-impact action is **casting a vote**. A frozen voter-roll entry alone is no longer sufficient: the vote path also checks current civic identity assurance.

## Provider onboarding rule

A provider must not be added to the allowlist until the integration guarantees that its `external_identities` row is created only after a successful identity-proofing result. SSO, email matching, wallet ownership, account age, civic reputation, or possession of a CTG One account are insufficient by themselves.

For a Cartagena pilot, the selected provider should be evaluated for, at minimum:

- government-issued document verification appropriate to Colombia;
- anti-spoofing / liveness or an equivalent person-presence control where applicable;
- duplicate-person resistance;
- auditable verification outcome and provider reference;
- revocation/review path;
- data-minimization and retention controls compatible with Colombian data-protection obligations;
- operational availability and incident response.

## Deliberate limitations of P0.1

This phase establishes the trust boundary and closes the vote path, but does not claim full identity maturity yet. Follow-up phases must:

1. integrate the selected production identity provider and signed callback/webhook contract;
2. persist assurance lifecycle metadata (verified/revoked/expired/review) independently from generic federation links;
3. rebuild frozen voter-roll membership so quorum denominators include only assured identities;
4. extend assurance requirements to proposal creation, endorsement and vote delegation according to the governance policy;
5. add administrative review, revocation, reconciliation and audit evidence;
6. expose actionable assurance onboarding in the citizen dashboard.

## Security invariant

**No code path may infer civic identity assurance merely from a login, matching email, CTG One federation, self-declared cédula, wallet signature, reputation score, or prior voter-roll membership.**

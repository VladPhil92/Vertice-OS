# Phase 7G.2 — Verification & Governance Eligibility

## Status

IMPLEMENTED on candidate branch. Repository integration does not by itself certify a public residence-evidence provider, election operation, legal policy, staging deployment or production rollout.

## Objective

Connect Phase 7G.1 residence assurance to governance without collapsing identity, residence and electoral authority into one mutable account flag.

The authorization model is:

`identity proof + scope-compatible current residence assurance -> electorate admission -> immutable frozen voter roll`

Before voting opens, current proof state is authoritative. Once `voting_starts_at` exists, `proposal_voter_roll` becomes authoritative for that election and current account changes cannot silently rewrite membership.

## Residence validity policy

Phase 7G.2 defines the initial engineering policy:

- residence assurance validity: **365 days** from approval;
- renewal window: **30 days** before expiration;
- an unexpired verification outside the renewal window is reused rather than creating duplicate review work;
- during the renewal window a new `submitted` request may coexist with the still-valid verification;
- approval of a renewal supersedes the previously current verified request and atomically binds the citizen to the new request;
- expiration is evaluated from `territory_assurance_requests.expires_at`; the mutable aggregate `citizens.territory_assurance_level` is never sufficient by itself.

These durations are an engineering policy, not a representation of Colombian electoral law or a certified legal retention rule. They must be independently approved before a production civic election relies on them.

## Eligibility rules before electorate freeze

Every proposal requires current Civic Identity Assurance from an operational trusted provider.

For `national` scope, identity assurance is sufficient from the territorial perspective: municipal residence is deliberately **not** required for national participation.

For every subnational scope, the citizen must additionally have a current `territory_assurance_request_id` whose request:

1. belongs to that citizen;
2. is `verified`;
3. has assurance level at least `1`;
4. was verified no later than the eligibility evaluation;
5. has `expires_at` strictly after the evaluation;
6. matches the citizen's current durable home territory;
7. matches the proposal's territorial scope.

Scope compatibility is server-authoritative:

- `city`: exact municipality/district;
- `regional`: same parent department;
- `locality`: exact municipality/district plus locality;
- `neighborhood`: exact municipality/district plus neighborhood, and locality when the proposal carries one;
- `national`: no municipal residence prerequisite.

GPS position, active travel context, report location, reputation, subscription tier, payments and donations remain non-authoritative.

## Eligibility preflight API

Authenticated verified citizens can call:

`GET /governance/proposals/:id/eligibility`

Before voting opens, the response reports `authority: current_assurance` or `none` and separates:

- Civic Identity Assurance;
- territorial residence assurance;
- scope compatibility;
- expiration state;
- frozen-electorate state.

Reason codes include:

- `ELIGIBLE_CURRENT_ASSURANCE`
- `IDENTITY_ASSURANCE_UNAVAILABLE`
- `IDENTITY_ASSURANCE_REQUIRED`
- `TERRITORY_ASSURANCE_REQUIRED`
- `TERRITORY_ASSURANCE_EXPIRED`
- `TERRITORY_SCOPE_MISMATCH`

The endpoint is explanatory. It does not itself grant voting authority.

## Frozen electorate provenance

At `debate -> voting`, the server selects the exact current proofs and snapshots them into `proposal_voter_roll`.

Identity provenance:

- `identity_proof_id`
- `identity_provider`
- `identity_verified_at`
- `identity_expires_at`

Subnational residence provenance:

- `territory_code`
- `territory_assurance_level`
- `territory_assurance_request_id`
- `territory_verified_at`
- `territory_assurance_expires_at`

PostgreSQL validates each inserted row against the underlying identity proof and residence-assurance request at `frozen_at`. Invalid direct writes fail closed.

## Authority after voting opens

When `voting_starts_at` is non-null, the eligibility preflight no longer re-evaluates mutable current assurance to decide membership.

The result is instead:

- member of frozen roll -> `ELIGIBLE_FROZEN_ELECTORATE`;
- no frozen roll -> `VOTER_ROLL_UNAVAILABLE`;
- frozen roll exists but citizen is absent -> `NOT_IN_FROZEN_ELECTORATE`.

This preserves the existing one-person/one-effective-vote ledger contract and prevents residence expiration, renewal, movement, account profile edits or proof-provider changes after the opening instant from silently changing the electorate.

A future policy may define exceptional adjudication for fraud, court orders or election cancellation. Phase 7G.2 does not introduce an ad-hoc mutable exception path.

## Database authority

The Phase 7G.2 migration:

- adds `verified_at` and `expires_at` to residence assurance requests;
- backfills existing verified 7G.1 decisions with bounded validity;
- changes the concurrency invariant to one `submitted` review per citizen/territory so renewal can coexist with a valid current decision;
- extends voter-roll provenance columns;
- validates current assurance elevation against an unexpired verified request;
- replaces the territorial voter-roll interlock with exact identity + residence provenance validation;
- extends `protect_frozen_voter_roll()` so all new provenance fields are immutable after voting opens.

## Security invariants

1. `citizens.territory_assurance_level` alone cannot authorize subnational participation.
2. A stale or expired verified request cannot enter a newly frozen electorate.
3. A valid Cartagena residence cannot authorize a Medellín city proposal.
4. A national proposal cannot manufacture a municipal-residence requirement.
5. A voter-roll row without exact Civic Identity Assurance provenance is rejected.
6. A subnational voter-roll row without exact territorial assurance provenance is rejected.
7. Once voting opens, identity/residence provenance in that voter roll cannot be rewritten.
8. The vote ledger continues to authorize from frozen membership rather than mutable current account state.

## Golden evidence

The Golden governance journey now proves:

1. identity-assured citizens select Cartagena as durable home territory;
2. independent proof-backed residence assurance is approved;
3. eligibility preflight reports current-assurance authority before voting;
4. debate -> voting freezes exact identity and territorial assurance provenance;
5. post-freeze preflight reports `frozen_electorate` authority;
6. delegation and direct-vote override preserve one person, one effective vote;
7. tallies and eligible-voter counts remain internally consistent.

Unit tests separately cover current eligibility, expiration, scope mismatch, national identity-only behavior, missing identity assurance, absent voter roll and frozen non-membership.

## Release boundary

Phase 7G.2 can reach `INTEGRATED` when exact-SHA CI, migration tests, Golden API journeys, browser contracts and governance checks pass.

It does **not** claim:

- certified Colombian electoral-law compliance;
- certified residence evidence/provider operations;
- production deployment of the new database migration;
- web/mobile UX completeness;
- operator adjudication procedures;
- staging or production election certification.

## Next construction order

1. **Phase 7G.3 — Citizen Experience:** web/mobile residence status, renewal, eligibility explanation and remediation workflow.
2. **Phase 7G.4 — Territorial Assurance Certification:** dedicated exact-SHA certification gate, provider/operator evidence, migration evidence and adversarial scenarios.
3. **Election policy certification:** legal/operational approval of validity, exceptional adjudication and real-election procedures before any binding production election.

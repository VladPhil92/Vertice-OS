# Phase 7G.1 — Territorial Residence Assurance Core

## Status

IMPLEMENTED on candidate branch. Merge does not by itself certify residence providers, legal policy or subnational governance rollout.

## Objective

Introduce the missing proof-backed transition between a citizen's self-selected home municipality/district and a durable territorial assurance state.

The core invariant remains:

`home territory != active territory != contribution target != verified residence`

Phase 7F proves where a civic event happened. Phase 7G.1 creates an independent, auditable residence-assurance contract. GPS, polygon matching, identity proofing, reputation, subscriptions, donations and other financial activity cannot elevate territorial assurance.

## Assurance levels

- `0` — no verified residence assurance; selected territory is product/community context only.
- `1` — proof-backed municipal/district residence assurance.
- `2` — reserved for a future higher-assurance policy/provider contract; Phase 7G.1 does not issue it automatically.

A level greater than zero is a governance prerequisite only. It is not by itself sufficient for voting eligibility; identity assurance, proposal scope and frozen-electorate rules remain independent gates.

## Durable model

`territory_assurance_requests` stores the lifecycle of a verification request:

- citizen and exact municipality/district;
- `submitted | verified | rejected | revoked | superseded` status;
- requested assurance level;
- evidence type;
- SHA-256 digest of an opaque secure evidence reference;
- reviewer, decision reason and timestamps.

Raw documents, raw evidence locators and GPS coordinates are deliberately not stored in this table.

`territory_assurance_events` provides append-style lifecycle history for reconstruction of submission, verification, rejection, revocation and automatic supersession.

`citizens.territory_assurance_request_id` binds the currently effective assurance to the exact verified request that produced it.

## Database authority

The database fails closed when application code tries to elevate territorial assurance without:

1. a current home territory;
2. a verified request belonging to the same citizen;
3. the exact same municipality/district;
4. matching assurance level;
5. matching evidence provenance source;
6. a verification timestamp.

Changing the citizen's durable home municipality/district automatically resets assurance to level `0`, clears current request provenance and marks the previous verified request `superseded`.

This prevents an assurance obtained for Cartagena from silently following the citizen to Medellín or becoming reusable after a later territory change.

## API contract

Authenticated citizen:

- `GET /territories/assurance/me`
- `POST /territories/assurance/requests`

Submission body:

```json
{
  "evidence_type": "secure_document",
  "evidence_reference": "vault:opaque/reference-token"
}
```

The raw `evidence_reference` is hashed before persistence.

Superadmin operational control:

- `GET /territories/admin/assurance/requests`
- `POST /territories/admin/assurance/requests/:requestId/decision`

Supported decisions are `approve`, `reject` and `revoke`. Server-side lifecycle checks reject invalid transitions and refuse approval if the citizen changed home territory after submission.

## Privacy boundary

- no document payload is persisted in the assurance ledger;
- no GPS coordinate is accepted by the assurance endpoint;
- only a SHA-256 digest of a high-entropy opaque evidence reference is persisted;
- the request is not a movement-history record;
- deleting a citizen can sever citizen/reviewer foreign keys without destroying the audit event chronology.

Any future evidence vault/provider must define its own retention, access control, deletion and legal basis before production use.

## Governance boundary

Phase 7G.1 does not weaken or bypass the existing frozen-voter-roll interlocks. It establishes a legitimate source for `territory_assurance_level >= 1`.

It does not make any of the following sufficient proof of residence:

- DANE/PostGIS point-in-polygon match;
- active GPS context;
- creation of a report/action in a municipality;
- Veriff/Civic Identity Assurance alone;
- follower/reputation activity;
- Free/Pro status;
- donation, crowdfunding, payout or payment activity.

## Golden evidence

The Golden assurance journey proves that:

1. a citizen selects a home municipality;
2. a request stores a digest rather than the raw evidence reference;
3. direct assurance elevation without verified provenance is rejected by PostgreSQL;
4. approval binds the citizen to the exact verified request;
5. changing home municipality resets assurance and supersedes the old request.

Unit tests also cover duplicate active request reuse, missing/invalid home territory, approve/reject/revoke transitions and deleted-account fail-closed behavior.

## Release boundary

Repository CI can certify schema, service behavior, API contract and deterministic PostgreSQL enforcement. It cannot certify that a real residence-evidence provider, manual-review operation or legal retention policy is production-ready.

Before public residence verification is enabled, a later phase must define and certify:

- accepted evidence policy and freshness;
- reviewer/provider authentication and operational controls;
- expiration/renewal policy;
- governance eligibility preflight UX;
- web/mobile citizen workflow;
- legal/privacy approval for the external evidence system.

## Next construction order

1. **Phase 7G.2 — Verification & Governance Eligibility:** eligibility preflight, expiration/renewal policy and frozen-electorate provenance.
2. **Phase 7G.3 — Citizen Experience:** web/mobile status, submission and remediation UX.
3. **Phase 7G.4 — Territorial Assurance Certification:** dedicated exact-SHA gate, provider/operator evidence and adversarial Golden scenarios.

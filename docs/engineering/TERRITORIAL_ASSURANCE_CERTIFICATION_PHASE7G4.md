# Phase 7G.4 — Territorial Assurance Certification

## Status

IMPLEMENTED on candidate branch.

A green Phase 7G.4 workflow establishes **CODE_CERTIFIED** for the exact submitted SHA: repository contracts, targeted tests and adversarial database journeys passed on that candidate.

It deliberately leaves production at **BLOCKED_EXTERNAL_EVIDENCE** until real provider, operator and legal/privacy evidence is supplied and reviewed.

`CODE_CERTIFIED` never means production election CERTIFIED.

## Objective

Certify that proof-backed territorial residence assurance remains fail-closed at the election boundary and that the exact candidate being reviewed preserves the invariants introduced in Phases 7G.1–7G.3.

The certification model is:

`exact candidate SHA + source contract + unit policy + real Postgres adversarial journey -> CODE_CERTIFIED`

followed separately by:

`CODE_CERTIFIED + provider/operator/legal evidence -> ready_for_operator_release_review`

A human/operator release decision remains required after that point.

## Exact-SHA invariant

The dedicated certification workflow checks out `github.event.pull_request.head.sha` for pull requests and verifies `git rev-parse HEAD` against the expected SHA before running certification logic.

A merge ref, stale branch SHA or locally inferred revision cannot be certified as the submitted candidate.

## Automated certification scope

The repository can automatically certify:

- territorial assurance validity and renewal policy remain 365/30 days;
- self-review remains forbidden;
- citizen submission accepts only bounded opaque evidence references;
- HTTP(S) evidence URLs remain rejected;
- administrator review remains superadmin-gated;
- current eligibility remains identity + fresh proof-backed residence + scope match;
- expired residence fails closed;
- municipality/department/locality/neighborhood mismatch fails closed;
- national governance does not manufacture a municipal residence requirement;
- once voting opens, frozen voter-roll membership becomes authoritative;
- voter-roll identity/residence provenance remains immutable after freeze;
- post-freeze residence changes or later verification cannot retrospectively alter the electorate;
- web and mobile continue consuming the server-authoritative eligibility preflight.

## Adversarial database journey

`golden-territorial-assurance-certification.integration.test.ts` runs against real PostgreSQL/PostGIS plus the normal integration dependencies.

The journey certifies this sequence:

1. a Cartagena resident with current residence assurance is eligible for a Cartagena city proposal;
2. a Medellín resident with valid assurance is rejected for that Cartagena proposal;
3. forced expiry of the Cartagena assurance removes current eligibility;
4. a new reviewed assurance restores current eligibility;
5. the electorate is frozen with exact identity and residence provenance;
6. the previously eligible citizen changes home municipality after freeze and remains eligible only because of frozen membership;
7. the previously excluded citizen later changes to Cartagena and verifies residence, but remains excluded from the already-frozen election;
8. the voter-roll snapshot is unchanged after those mutations.

## External controls required for production release review

Every production evidence item must be represented by an opaque evidence reference, not a raw document or public/signed URL.

The required controls are:

- `provider_production_canary` — real production-provider flow completed and independently checked;
- `operator_reviewer_separation` — evidence that requester and reviewer/operator duties remain separated;
- `privacy_legal_approval` — approved privacy/legal basis and evidence-handling procedure;
- `revocation_drill` — verified residence can be revoked and future eligibility fails closed;
- `expiry_renewal_drill` — expiry and renewal behavior demonstrated against the production-like environment;
- `scope_mismatch_drill` — a valid assurance for another territory cannot authorize the target electorate;
- `frozen_electorate_drill` — post-freeze changes do not rewrite a frozen electorate.

The policy evaluator returns:

- `blocked_external_evidence` while any required evidence is missing/invalid; or
- `ready_for_operator_release_review` when all evidence references are present and the exact SHA matches.

It never returns automatic production certification.

## Evidence minimization

Certification evidence must not store or commit:

- identity documents;
- residence documents;
- government identification numbers;
- exact residential addresses;
- GPS traces or movement history;
- photographs;
- signed provider URLs;
- provider secrets or API credentials.

Only opaque evidence references, timestamps, result metadata and accountable reviewer/operator identifiers should enter release records.

## Failure behavior

Any SHA mismatch, missing external control, invalid evidence reference, failing source contract, failing unit test or failing adversarial PostgreSQL journey blocks certification.

A failed or unavailable provider/operator canary cannot be replaced by unit tests, repository screenshots or a manual statement that the feature "looks correct".

## Release ladder

- `IMPLEMENTED` — source exists.
- `INTEGRATED` — ordinary repository CI is green and the phase is merged.
- `CODE_CERTIFIED` — dedicated Phase 7G.4 exact-SHA certification is green.
- `BLOCKED_EXTERNAL_EVIDENCE` — default production state after code certification.
- `ready_for_operator_release_review` — all required external evidence references are present and valid.
- `CERTIFIED` — only an explicit production release/election-policy decision may assign this state.

## Rollback boundary

Certification tooling can be reverted without changing historical votes. Frozen voter-roll rows and their identity/residence provenance must never be destructively rewritten as part of rollback.

## Next logical phase

After Phase 7G.4 code certification, the next work is **production/operator certification and election-policy release readiness**: run real provider canaries, legal/privacy sign-off, operator drills and final production election controls before any binding election is declared CERTIFIED.

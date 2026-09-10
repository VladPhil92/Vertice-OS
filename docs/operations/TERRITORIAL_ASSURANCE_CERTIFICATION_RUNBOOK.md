# Territorial Assurance Certification Runbook — Phase 7G.4

## Purpose

This runbook defines the operator procedure for collecting the external evidence required after the repository reaches `REPOSITORY_CONTRACT_READY`.

It does not authorize a production election by itself. Execution must remain bound to one exact 40-character candidate SHA.

## Roles and segregation

At minimum, keep these authorities distinct:

- **Applicant / citizen** — submits residence evidence through the approved secure channel.
- **Residence reviewer** — may approve/reject/revoke assurance but must never review their own request.
- **Release operator** — executes the production canary and records release evidence.
- **Election policy owner** — approves the territorial eligibility policy for the bounded election scope.
- **Privacy/legal approver** — approves the evidence-processing boundary where required.

One person may hold more than one organizational role only when the approved governance policy permits it, but applicant and residence reviewer separation is mandatory and enforced by the application.

## Stop conditions

Stop the certification and record `BLOCKED` if any of the following is true:

- candidate SHA is not the exact release commit;
- exact-SHA repository certification is red or incomplete;
- production provider is unavailable or not authenticated;
- raw residence documents would need to be copied into the VÉRTICE repository/database;
- reviewer separation cannot be demonstrated;
- audit events cannot be exported and correlated to the candidate;
- revocation cannot be exercised fail-closed;
- privacy/legal or election-policy approval is absent for a binding election.

Never convert a failed stop condition into a passing boolean for convenience.

## Evidence reference convention

Every evidence reference must identify an immutable or auditable record outside the source repository, for example an authorized audit artifact, provider receipt, signed approval record or controlled release-evidence object.

Do not use `TBD`, `TODO`, `REPLACE_*` or a mutable branch URL as evidence. Do not place raw residence documents, identity-document images, exact-address images, GPS trails or provider secrets in the reference field.

## Procedure A — exact-SHA repository gate

1. Record the candidate SHA from the PR/release candidate.
2. Confirm `Territorial Assurance Certification / Exact-SHA territorial assurance certification` completed successfully for that SHA.
3. Confirm the checkout assertion in the job equals the recorded candidate SHA.
4. Confirm source contract, API typecheck, policy tests and real Golden assurance/governance journeys passed.
5. Record the workflow/run evidence reference.

A green result establishes `REPOSITORY_CONTRACT_READY`; it does not establish `PRODUCTION_ELECTION_CERTIFIED`.

## Procedure B — production provider canary

Use only the authorized production residence-assurance provider/channel.

1. Submit a synthetic/non-sensitive canary using the same integration path as production.
2. Verify VÉRTICE receives only the approved opaque evidence reference, never the raw residence document.
3. Verify provider decision authenticity using the configured trust mechanism.
4. Replay the same provider event/reference and confirm replay protection prevents duplicate authority/effects.
5. Confirm the canary decision can be correlated to the exact candidate SHA and audit trail.
6. Record the provider evidence bundle reference.

If a provider canary cannot be performed safely without real citizen PII, stop and redesign the canary rather than weakening the privacy boundary.

## Procedure C — reviewer-separation check

1. Create a controlled assurance request owned by the canary/test subject.
2. Attempt approval with the same subject identity and confirm `TERRITORY_ASSURANCE_SELF_REVIEW_FORBIDDEN`.
3. Complete the review with the authorized independent reviewer.
4. Export the request and assurance-event audit records.
5. Record the evidence reference proving applicant/reviewer separation.

## Procedure D — revocation drill

1. Start from a currently verified controlled assurance request.
2. Revoke it through the authorized service path; do not edit the voter roll directly.
3. Confirm the citizen cannot enter a newly frozen subnational electorate using the revoked assurance.
4. Confirm previously frozen historical electorate provenance remains unchanged/auditable.
5. Confirm user-facing preflight returns a fail-closed reason for future admission.
6. Record the revocation-drill evidence reference and observation timestamp.

## Procedure E — adversarial certification set

For the exact release candidate, retain a separate observation/reference for every mandatory scenario:

- `self_review_rejected`
- `expired_assurance_rejected`
- `territory_change_invalidates_assurance`
- `scope_mismatch_rejected`
- `renewal_does_not_rewrite_frozen_roll`
- `revocation_blocks_future_admission`
- `gps_cannot_grant_residence`
- `reputation_cannot_grant_residence`
- `payments_cannot_grant_residence`
- `identity_assurance_cannot_grant_residence`

Each record must contain `passed: true`, a non-placeholder `evidence_reference`, and a valid `observed_at` timestamp.

## Procedure F — audit export

Export sufficient assurance/governance audit data to prove:

- request identity and territorial binding;
- reviewer/actor identity reference;
- status transitions and decision reason;
- verification, expiry, supersession or revocation timestamps;
- frozen voter-roll provenance where applicable;
- absence of destructive rewriting after vote opening.

Use the minimum data necessary. Prefer pseudonymous identifiers and digests. Do not include raw residence evidence in routine certification exports.

## Procedure G — policy approvals

Before a binding subnational election, obtain and reference:

1. privacy/legal approval for the residence evidence flow;
2. territorial election eligibility-policy approval;
3. named election policy owner;
4. approval timestamp;
5. immutable/auditable approval reference.

The approval scope must identify the bounded pilot/election context. A generic product approval must not be silently reused for a materially different election policy.

## Procedure H — evidence-bundle evaluation

1. Copy `docs/operations/territorial-assurance-certification-evidence.example.json` into the authorized external release-evidence system, not into source control as a passing artifact.
2. Replace the candidate SHA with the exact release SHA.
3. Fill provider/operator/policy assertions only after evidence exists.
4. Attach the required evidence references and adversarial observation timestamps.
5. Evaluate the bundle through the Phase 7G.4 certification policy.
6. If any blocker remains, status is `BLOCKED` or `EXTERNAL_EVIDENCE_REQUIRED`; do not override it manually.
7. Only a zero-blocker result may emit `PRODUCTION_ELECTION_CERTIFIED`.

## Incident response

If an assurance integrity incident is suspected:

1. stop new production certification/electorate freezes that depend on the affected assurance path;
2. preserve assurance-event and voter-roll audit evidence;
3. revoke compromised current assurance through the authorized service where appropriate;
4. do not rewrite already frozen voter-roll provenance;
5. identify candidate SHA, provider references, affected requests and decision timestamps;
6. notify the designated security/privacy/election-policy owners;
7. remediate and create a new release candidate;
8. rerun repository certification and all affected external evidence against the new exact SHA.

## Rollback boundary

Application or certification tooling can be rolled back, but frozen election provenance is append-only/auditable. Never perform destructive rollback of voter-roll evidence to make a new release appear compatible with an old certification.

Any certification evidence tied to an abandoned SHA is invalid for a later SHA and must be recollected or explicitly re-observed under the new candidate.

## Completion record

The operator completion record should contain:

- candidate SHA;
- repository certification run reference;
- provider evidence bundle reference;
- operator evidence bundle reference;
- all ten adversarial evidence references/timestamps;
- privacy/legal approval reference;
- election-policy approval reference, owner and timestamp;
- final policy-engine boundary;
- bounded pilot/election scope.

Until all required evidence exists, the correct release state is `EXTERNAL_EVIDENCE_REQUIRED`, not `READY` or `CERTIFIED`.

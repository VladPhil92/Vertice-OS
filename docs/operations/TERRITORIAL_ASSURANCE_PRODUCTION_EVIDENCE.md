# Territorial Assurance — Production Certification Evidence

Use this runbook only after the exact candidate SHA has passed Phase 7G.4 `CODE_CERTIFIED` checks.

Do not paste personal documents, addresses, identity numbers, provider secrets, signed URLs or raw evidence into GitHub. Record opaque evidence references only.

## Candidate

- Candidate SHA: `<40-char-sha>`
- Environment: `<production|production-like>`
- Release/election identifier: `<opaque-reference>`
- Operator reference: `<opaque-reference>`
- Review timestamp (UTC): `<ISO-8601>`

## Mandatory evidence controls

| Control | Opaque evidence reference | Result | Observed at (UTC) | Independent reviewer reference |
| --- | --- | --- | --- | --- |
| `provider_production_canary` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `operator_reviewer_separation` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `privacy_legal_approval` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `revocation_drill` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `expiry_renewal_drill` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `scope_mismatch_drill` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |
| `frozen_electorate_drill` | `<vault:...>` | PASS / FAIL | `<ISO-8601>` | `<operator:...>` |

## Drill acceptance criteria

### Provider production canary

A real provider/reference path must create a submitted residence-assurance request without storing the raw evidence artifact. Approval must be attributable to an authorized reviewer different from the citizen. The resulting assurance must be bounded in time.

### Reviewer separation

The citizen/requester must not be able to approve, reject or revoke their own request. Evidence must demonstrate the production role boundary, not only the unit test.

### Privacy/legal approval

The approved operational procedure must define lawful basis, retention, access controls, evidence minimization, incident handling and the prohibition on using GPS/current travel context as proof of residence.

### Revocation drill

Revoke a valid assurance in a controlled account. Confirm that the current assurance no longer authorizes entry to a newly frozen subnational electorate. Confirm that historical frozen voter rolls remain unchanged.

### Expiry/renewal drill

Demonstrate that an expired assurance fails closed for a new electorate. Demonstrate that renewal creates new provenance and supersedes only the previous current assurance without rewriting historical voter-roll rows.

### Scope mismatch drill

A valid assurance for municipality/district A must not authorize a city/locality/neighborhood electorate in municipality/district B. Regional matching must remain constrained to the authoritative parent department.

### Frozen electorate drill

After voting opens, change current residence/identity state in a controlled account. Confirm that membership in the already-frozen electorate remains authoritative and immutable. A citizen excluded at freeze must not become eligible retroactively by verifying later.

## Decision

Production status before the final operator decision must be one of:

- `BLOCKED_EXTERNAL_EVIDENCE`; or
- `ready_for_operator_release_review`.

Only the accountable production release/election-policy authority may record `CERTIFIED` after reviewing the complete evidence set and confirming that the deployed SHA matches the code-certified candidate.

## Stop conditions

Stop certification and mark the release blocked if any of the following occurs:

- deployed SHA differs from the code-certified candidate;
- a mandatory evidence control is missing or FAIL;
- evidence contains raw PII/secrets instead of opaque references;
- requester/reviewer separation is not demonstrated;
- expired/revoked assurance remains usable for a new electorate;
- scope mismatch is admitted;
- a frozen voter roll changes after voting opens;
- provider or operator behavior cannot be reproduced deterministically enough for audit.

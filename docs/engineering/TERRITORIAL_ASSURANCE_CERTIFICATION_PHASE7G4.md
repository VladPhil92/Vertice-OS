# Phase 7G.4 — Territorial Assurance Certification

## Status

IMPLEMENTED on candidate branch. This phase certifies repository contracts and defines the evidence boundary for production territorial assurance. It does **not** allow a green pull request to self-declare a binding election certified.

## Objective

Close the gap between integrated territorial-assurance code and evidence-backed operational readiness.

The release chain is:

`exact candidate SHA -> repository contract verification -> adversarial assurance evidence -> provider/operator evidence -> legal/privacy + election-policy approval -> production election certification`

## Certification states

### `REPOSITORY_CONTRACT_READY`

The code path, data invariants, source contracts and automated tests are present and passing for the exact candidate SHA. This is an engineering statement only.

### `EXTERNAL_EVIDENCE_REQUIRED`

The repository contract is ready, but at least one production artifact is absent: provider canary, reviewer separation, revocation drill, audit export, incident runbook, legal/privacy approval, election-policy approval or required adversarial evidence.

This is the expected state of normal pull-request CI.

### `PRODUCTION_ELECTION_CERTIFIED`

This state may be emitted only when the repository contract is ready **and** a complete evidence bundle belongs to the exact candidate SHA and satisfies every mandatory provider, operator, policy and adversarial condition.

A repository test cannot manufacture this state by itself.

## Exact-SHA rule

External evidence is valid only for the exact candidate SHA under certification. Evidence issued for another commit is rejected with `external_evidence_sha_mismatch`.

No branch name, tag, deployment alias or moving `main` reference can substitute for the exact commit hash.

## Provider evidence required

A production certification bundle must prove:

- named production assurance provider;
- only opaque evidence references cross the VÉRTICE application boundary;
- raw residence-document storage remains disabled in VÉRTICE;
- authenticity of provider decisions is verified;
- replay protection is verified;
- a production canary passed for the exact candidate release.

Provider availability or successful identity proofing alone does not prove territorial residence.

## Operator evidence required

Certification also requires:

- reviewer separation: the applicant cannot decide their own residence assurance;
- successful revocation drill;
- verified audit export for assurance requests/events;
- approved incident response runbook.

Manual review is permitted only inside this auditable, segregated process. A privileged operator cannot bypass the database or frozen-electorate invariants.

## Election-policy evidence required

Binding subnational elections additionally require explicit:

- legal/privacy approval for the evidence flow;
- approval of the territorial eligibility policy;
- named policy owner;
- valid approval timestamp.

These approvals are external governance facts. CI can verify their required shape but cannot invent the approvals.

## Mandatory adversarial scenarios

The certification model requires evidence that all of these scenarios pass:

1. `self_review_rejected` — a citizen cannot approve their own assurance request.
2. `expired_assurance_rejected` — expired residence cannot admit a citizen to a newly frozen subnational electorate.
3. `territory_change_invalidates_assurance` — changing the durable home municipality/district invalidates current residence assurance.
4. `scope_mismatch_rejected` — assurance for one territory cannot authorize an incompatible proposal scope.
5. `renewal_does_not_rewrite_frozen_roll` — renewing residence never mutates an electorate already frozen.
6. `revocation_blocks_future_admission` — revoked assurance cannot authorize future electorate admission.
7. `gps_cannot_grant_residence` — current location/active territory cannot raise residence assurance.
8. `reputation_cannot_grant_residence` — reputation cannot raise residence assurance or voting authority.
9. `payments_cannot_grant_residence` — payments, Pro status, donations and crowdfunding cannot raise residence assurance.
10. `identity_assurance_cannot_grant_residence` — civic identity proofing cannot silently raise territorial assurance.

## Automated repository gate

The Phase 7G.4 certification gate validates the exact submitted SHA and must include:

- source certification contract;
- API typecheck;
- dedicated certification policy tests;
- the real PostGIS/Redis/Neo4j territorial-assurance Golden journey;
- the real governance Golden journey;
- current Phase 7G.3 web/mobile server-authority contracts.

A passing automated gate therefore establishes repository readiness, not external production certification.

## Privacy invariant

VÉRTICE must not become a general repository for residence documents. The application receives an opaque reference that is digested before durable persistence. Raw documents, exact address images, government IDs, GPS trails and public/signed evidence URLs remain outside this application data path.

## Frozen-electorate invariant

At electorate freeze, exact identity and territorial-assurance provenance are snapshotted. Once voting opens, later renewal, revocation, identity changes or territory changes cannot rewrite membership for that election.

Revocation or expiration affects future admissions and current pre-freeze eligibility; historical frozen evidence remains auditable.

## Evidence artifact policy

A production evidence bundle should be generated and retained by the authorized release/operator process. A fully passing production evidence JSON **must not be committed as a fabricated passing artifact** merely to turn CI green.

Repository examples/templates must remain clearly non-certified and contain false/placeholder assertions where external proof is absent.

## Release decision

Engineering may declare **REPOSITORY_CONTRACT_READY** after an exact-SHA green gate.

Engineering must declare **EXTERNAL_EVIDENCE_REQUIRED** when external proof is absent or incomplete.

Only the authorized operational/policy process may supply the evidence necessary for **PRODUCTION_ELECTION_CERTIFIED**.

## Next construction order

After 7G.4 repository certification is green:

1. collect real provider/operator canary evidence in the production environment;
2. execute privacy/legal and election-policy review;
3. run the full adversarial certification set against the release candidate;
4. certify a bounded pilot election before any broader subnational governance rollout;
5. proceed toward Phase 7H — Subnational Governance Certification / pilot release governance.

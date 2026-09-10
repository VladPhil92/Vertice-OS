# Phase 7G.3 — Territorial Citizen Experience

## Status

IMPLEMENTED on candidate branch, stacked on Phase 7G.2. Source presence or a green pull request does not by itself mean the residence evidence operation, election policy or production release is DEPLOYED, READY or CERTIFIED.

## Objective

Make territorial assurance and governance eligibility understandable and actionable for citizens without moving any authorization decision into web or mobile clients.

The product contract is:

`server eligibility reason -> citizen explanation -> bounded remediation`

not:

`client state -> inferred voting authority`.

## Citizen states

Web and mobile distinguish the following residence states:

- no verified residence;
- verification request submitted and under review;
- verified residence with more than 30 days remaining;
- verified residence inside the 30-day renewal window;
- expired residence assurance;
- changed home territory, which invalidates the previous current assurance.

The validity policy remains Phase 7G.2 authority: 365 days from verification, with renewal available during the final 30 days. Clients display those server fields; they do not calculate or grant governance authority independently.

## Web surfaces

### `/dashboard/territory`

The existing national territory selector remains available and now adds a residence-assurance center:

- current home municipality/district;
- assurance status;
- verification and expiration dates;
- pending request state;
- renewal action when the server exposes the renewal window;
- secure evidence-reference submission;
- explicit privacy and authority boundary;
- links to identity and governance remediation.

Only an opaque provider/vault reference is accepted by the user experience. Citizens are told not to paste documents, identity numbers, exact addresses, photographs, coordinates or HTTP(S) evidence URLs.

### `/dashboard/governance`

Every open vote requests `GET /governance/proposals/:id/eligibility` using the authenticated citizen session.

Vote controls fail closed:

- no preflight response -> disabled;
- `eligible: false` -> disabled with explanation/remediation;
- `eligible: true` -> enabled, while the vote endpoint remains the final server-side authority.

The UI no longer describes reputation as vote weight. Current governance semantics preserve one frozen-roll citizen as one effective participant; delegation may represent another citizen until that citizen casts a direct overriding vote.

## Mobile surfaces

### `/territory/assurance`

The Expo application exposes the same citizen residence lifecycle as web:

- home territory;
- effective/unverified/pending/expired/renewal state;
- bounded verification dates;
- opaque evidence-reference submission;
- route to change the durable home territory;
- explicit privacy and governance limits.

The request uses the existing mobile idempotent mutation client.

### Governance tab

For each voting proposal, mobile requests the same server eligibility preflight, renders the reason, and disables vote controls unless `eligible === true`.

Remediation routes are bounded to identity or territory-assurance surfaces. The app never creates a local fallback that treats location, reputation or payments as eligibility.

## Eligibility explanation contract

Phase 7G.3 recognizes the Phase 7G.2 reason codes exactly:

- `ELIGIBLE_CURRENT_ASSURANCE` — current identity and required residence assurance are valid;
- `ELIGIBLE_FROZEN_ELECTORATE` — citizen belongs to the immutable frozen electorate;
- `IDENTITY_ASSURANCE_UNAVAILABLE` — infrastructure unavailable; no bypass;
- `IDENTITY_ASSURANCE_REQUIRED` — identity remediation;
- `TERRITORY_ASSURANCE_REQUIRED` — residence remediation;
- `TERRITORY_ASSURANCE_EXPIRED` — renewal/remediation for future electorate freezes;
- `TERRITORY_SCOPE_MISMATCH` — verified residence does not match the proposal scope;
- `VOTER_ROLL_UNAVAILABLE` — fail closed because an opened election lacks an authoritative usable roll;
- `NOT_IN_FROZEN_ELECTORATE` — no retrospective admission; remediation can only prepare future votes.

## Frozen-electorate UX invariant

Once voting has opened, no citizen-facing action may imply that changing municipality, completing identity proofing or renewing residence can add the citizen to the current election.

For that election, frozen voter-roll membership is authoritative. Remediation after freeze is explicitly framed as preparation for future eligible processes.

## Privacy boundary

Phase 7G.3 does not add a raw-document store.

The clients must not request or persist:

- raw identity documents;
- raw residence documents;
- government identification numbers for this flow;
- exact GPS coordinates as residence evidence;
- movement history;
- signed/public evidence URLs.

The API receives the same opaque evidence reference defined by Phase 7G.1/7G.2, which is digested before durable persistence.

## Explicit non-authorities

The following remain incapable of granting territorial voting eligibility:

- GPS or active travel context;
- civic contribution geography;
- reputation score;
- follower count;
- Free/Pro subscription state;
- payments;
- donations;
- crowdfunding activity.

## Failure behavior

Web and mobile fail closed when eligibility cannot be retrieved. The absence of a response is never interpreted as permission.

The vote API and frozen voter-roll database contracts remain authoritative even if a modified or obsolete client ignores the UI control.

## Release evidence

Repository validation for this phase must preserve at least:

1. the server-authoritative `/governance/proposals/:id/eligibility` dependency on both clients;
2. disabled voting controls unless the returned preflight is eligible;
3. the `/territories/assurance/me` citizen status surface;
4. opaque-reference residence submission through `/territories/assurance/requests`;
5. explicit `ELIGIBLE_FROZEN_ELECTORATE`, `TERRITORY_ASSURANCE_EXPIRED` and `NOT_IN_FROZEN_ELECTORATE` explanations;
6. the mobile `/territory/assurance` route;
7. no reputation-based vote-weight copy.

## Release boundary

A successful source/build/test matrix establishes an integrated citizen experience only. Production residence assurance still depends on operator/provider procedures, privacy/legal approval and the election-policy certification described for Phase 7G.4.

## Next construction order

1. **Phase 7G.4 — Territorial Assurance Certification:** exact-SHA gate, provider/operator evidence, adversarial expiry/renewal/scope scenarios and election-policy release criteria.
2. Production rollout only after external evidence handling, legal/privacy controls and operational review are explicitly certified.

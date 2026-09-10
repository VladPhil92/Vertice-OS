# VÉRTICE Closed Pilot Runbook

Use this runbook only for a bounded, invite-only real-user pilot. It does not authorize a public/commercial launch.

## Candidate

- Candidate SHA: `<40-char-sha>`
- Web deployment reference: `<opaque-reference>`
- API deployment reference: `<opaque-reference>`
- Pilot cohort size: `10–30`
- Pilot territory: `Cartagena / 13001` for the first operational cohort
- Operator reference: `<opaque-reference>`
- Observation window: `<ISO-8601 start/end>`

Do not copy secrets, raw identity material, exact residence evidence or private user data into GitHub evidence.

## Invite-control activation

Before admitting external users, configure the API runtime with:

- `CLOSED_PILOT_MODE=true`;
- `CLOSED_PILOT_EMAIL_ALLOWLIST=<comma-separated invited emails>`.

The application normalizes and de-duplicates the list and caps the configured cohort at 30 identities. Do not place the allowlist itself in source control, screenshots, PR comments or public evidence.

When pilot mode is enabled, registration, login, refresh-token renewal and CTG One federation are restricted to invited identities. Existing short-lived access tokens issued before activation should be allowed to expire or the corresponding sessions should be revoked before the pilot observation window begins.

## Preflight

The pilot remains **STOP / BLOCKED** unless all applicable items pass:

- [ ] exact candidate SHA passed repository CI/security/governance gates;
- [ ] web and API belong to the intended release lineage and production evidence is tied to the same SHA/candidate;
- [ ] `CLOSED_PILOT_MODE=true` is configured in the API runtime;
- [ ] the private allowlist contains only the intended cohort and no more than 30 unique identities;
- [ ] `GET /health/live` returns 200;
- [ ] `GET /health/ready` returns 200;
- [ ] `GET /health/pilot` returns 200;
- [ ] `/health/pilot` reports `access_control.mode = closed_invite_only` and `configured = true`;
- [ ] `/health/pilot` reports database = `ok`;
- [ ] `/health/pilot` reports redis = `ok`;
- [ ] `/health/pilot` reports neo4j = `ok`;
- [ ] payments = `disabled`;
- [ ] crowdfunding_payments = `disabled`;
- [ ] payouts = `disabled`;
- [ ] crowdfunding_payouts = `disabled`;
- [ ] governance shown to pilot users is consultative/non-binding;
- [ ] moderation/reporting path is available;
- [ ] account deletion path is available;
- [ ] backup/recovery posture applicable to pilot data has an accountable operator.

## Golden pilot journeys

Execute with controlled test/pilot accounts before inviting the broader cohort:

1. verify a non-allowlisted identity is rejected by registration/login;
2. create or use an invited account, authenticate, refresh session and log out;
3. select Cartagena territory and load the local experience;
4. complete/update civic profile without granting unintended authority;
5. load Community/feed and follow/unfollow another controlled account;
6. create/read a bounded citizen report and verify evidence handling;
7. browse/create an allowed consultative proposal and verify no binding authority is implied;
8. open a workflow/case and verify permissions;
9. verify reputation UI does not convert money/followers into civic authority;
10. exercise user-report/moderation handling;
11. delete a controlled invited account and confirm refresh/login no longer works.

Optional capabilities such as AI may be observed when ready, but their absence must not be represented as successful certification.

## Runtime observation

During pilot operation, retain coarse operational evidence for:

- 5xx/error-rate spikes;
- health dependency state;
- rate-limit/abuse signals;
- moderation incidents;
- failed account deletion;
- unexpected financial/provider invocation;
- revision drift between candidate and runtime;
- unexpected access by an identity outside the configured cohort.

Use opaque references for incident/evidence records.

## STOP conditions

Immediately stop admitting or exercising pilot users if any of the following occurs:

- `/health/pilot` becomes non-200;
- invite-only access control is disabled, empty, oversized or bypassable;
- database, Redis or Neo4j becomes unavailable for the pilot contract;
- any monetary capability is no longer `disabled`;
- production revision is unknown or evidence cannot be tied to the candidate release;
- a user can perform an action outside the intended authorization boundary;
- account deletion is materially broken;
- moderation/abuse controls are unavailable during active UGC testing;
- a severe privacy/security incident is detected;
- governance is presented as legally/institutionally binding without separate authority.

## Decision record

Record one of these states only:

- `BLOCKED`
- `READY_FOR_CLOSED_PILOT`
- `PILOT_PAUSED`
- `PILOT_COMPLETED`

A `READY_FOR_CLOSED_PILOT` decision requires a 200 response from `/health/pilot` on the exact runtime candidate and completion of the preflight above. It must never be translated into `CERTIFIED FOR MARKET RELEASE`.

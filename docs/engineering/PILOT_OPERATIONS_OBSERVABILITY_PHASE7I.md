# Phase 7I — Pilot Operations & Observability

Snapshot: 10 September 2026.

## Objective

Phase 7I adds the operational layer required to learn safely from a bounded real-user pilot after Phase 7H established the closed-cohort release boundary.

The phase does **not** create a second civic source of truth. Existing PostgreSQL/PostGIS and domain ledgers remain authoritative for citizens, reports, governance, workflows and civic actions. The existing Pilot Control Center continues to aggregate durable civic outcomes. Phase 7I adds short-lived operational signals for journey health, usability feedback and pilot incidents.

## Operational model

The pilot receives a dedicated authenticated namespace:

- `GET /pilot/status` — participant-visible bounded pilot state;
- `POST /pilot/telemetry` — enumerated journey events only;
- `POST /pilot/feedback` — bounded feedback with automatic redaction;
- `GET /pilot/admin/summary` — moderator/admin operational summary;
- `POST /pilot/admin/incidents` — admin incident log.

The web pilot surface lives at `/dashboard/pilot`. The pre-existing `/dashboard/admin/pilot` remains the durable aggregate civic Pilot Control Center.

## Privacy boundary

Phase 7I follows data minimization by construction:

- raw citizen IDs are never written to the pilot streams;
- a dedicated `PILOT_TELEMETRY_PEPPER` creates a 24-hex HMAC pseudonym;
- this key is separate from `IDENTITY_PEPPER`, JWT, vote nullifier and other security domains;
- telemetry uses enumerated event/surface/outcome/platform fields and rejects unknown fields;
- telemetry cannot include arbitrary metadata, GPS, email, free-form URL or request payloads;
- feedback is limited to 500 characters;
- common email, telephone and long-number patterns are redacted before storage;
- incident summaries are redacted through the same boundary;
- Redis operational records expire after 30 days;
- stream lengths are capped to prevent unbounded collection.

Redis is an **ephemeral operational plane**, not legal evidence or a durable civic ledger. Anything that needs durable civic/legal provenance must continue through its canonical domain model.

## Authorization boundary

All participant operations require:

1. a valid authenticated citizen session;
2. Phase 7H closed-pilot mode enabled;
3. a configured invitation cohort;
4. `PILOT_TELEMETRY_PEPPER` configured with at least 32 characters.

Operational summary requires a live moderator/admin/superadmin role. Incident creation requires a live admin/superadmin role.

The Phase 7H allowlist remains the enrollment authority. Phase 7I does not introduce a parallel cohort registry.

## Metrics

Phase 7I intentionally starts with a small operational vocabulary:

- approximate unique pilot participants (Redis HyperLogLog over pseudonyms);
- counts by enumerated journey event;
- counts by outcome (`success`, `failure`, `abandoned`);
- latest redacted feedback;
- latest redacted incident records;
- exact deployed revision when a full 40-character Git SHA is available.

The operational layer must not calculate civic reputation, voting weight, ranking or financial eligibility.

## Event vocabulary

Allowed events are source controlled. Initial events cover:

- session start;
- onboarding completion;
- territory selection;
- Community load;
- follow completion;
- report submission;
- proposal exploration;
- workflow opening;
- moderation reporting;
- account deletion start/completion;
- feedback interaction.

Adding an event requires code review; clients cannot invent event names at runtime.

## Status ladder

1. `IMPLEMENTED` — routes, schemas, privacy functions and web feedback surface exist.
2. `CODE_GATE_PASS` — exact-SHA type/test/source contract is green.
3. `READY_FOR_RUNTIME_VALIDATION` — candidate may be deployed for pilot observability validation.
4. `OPERATIONAL` — active Phase 7H cohort + dedicated telemetry pepper + Redis roundtrip + operator summary all pass on the exact runtime.
5. `PILOT_PAUSED` — an operational STOP condition is active.

`OPERATIONAL` is not `CERTIFIED FOR MARKET RELEASE`.

## Runtime validation

A candidate is operational only when a controlled invited user can:

1. load `/pilot/status`;
2. submit an enumerated telemetry event;
3. submit redacted feedback from `/dashboard/pilot`;
4. have an authorized operator observe aggregated counts and the redacted feedback;
5. have an admin record an incident;
6. confirm the evidence belongs to the intended full Git revision.

## Non-authorities

Phase 7I does not authorize:

- public signup;
- real-money checkout or crowdfunding collection;
- payouts;
- production KYC authority;
- legally/institutionally binding elections;
- native App Store/Play release;
- market-release certification.

## Exit criterion

Phase 7I is complete when the exact candidate passes its dedicated code gate, applicable repository gates remain green, the privacy contract is intact, and the Closed Pilot Observability Runbook can be executed against a real active cohort without a STOP condition.

The next logical phase is controlled cohort activation and real-user pilot execution. That phase depends on real tester identities, an operational Neo4j path and runtime configuration that source code cannot fabricate.

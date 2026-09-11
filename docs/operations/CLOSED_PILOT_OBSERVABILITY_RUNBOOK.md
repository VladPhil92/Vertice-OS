# VÉRTICE Closed Pilot Observability Runbook

Use this runbook only after the Phase 7H Closed Pilot Readiness boundary is active. This document governs operational observation; it does not authorize public launch or higher-impact capabilities.

## Candidate

- Candidate SHA: `<40-char-sha>`
- API deployment reference: `<opaque-reference>`
- Web deployment reference: `<opaque-reference>`
- Pilot cohort: `<10–30 invited users>`
- Observation window: `<ISO-8601 start/end>`
- Operator reference: `<opaque-reference>`

Never record the telemetry pepper, allowlist contents, raw citizen IDs, exact residence evidence, identity documents, GPS trails, bank data or secrets in GitHub evidence.

## Preflight

The observability layer remains **STOP / BLOCKED** unless:

- [ ] Phase 7H `/health/pilot` returns HTTP 200 on the intended runtime;
- [ ] the runtime revision is the expected full 40-character Git SHA;
- [ ] `CLOSED_PILOT_MODE=true` and the invited cohort is configured;
- [ ] `PILOT_TELEMETRY_PEPPER` exists, is at least 32 characters and is independent from other cryptographic domains;
- [ ] Redis is healthy;
- [ ] payments, crowdfunding payments and payouts remain disabled;
- [ ] governance remains consultative/non-binding;
- [ ] moderation and account deletion remain available.

## Controlled telemetry roundtrip

Using one controlled invited account:

1. authenticate normally;
2. open `/dashboard/pilot`;
3. confirm `GET /pilot/status` returns `active`;
4. submit one allowed telemetry event to `POST /pilot/telemetry`;
5. verify the response is HTTP 202 and does not echo identity data;
6. load `GET /pilot/admin/summary` with an authorized operator;
7. verify the event count increased and the approximate user count is non-zero;
8. confirm no raw citizen ID, email or GPS field is present in the returned summary.

## Feedback roundtrip

Submit controlled text containing synthetic personal-looking values, for example a test email and test phone number. Confirm the admin summary contains the redaction placeholders rather than the submitted values.

Never use a real secret, real document number, real bank account or third-party personal data to perform this drill.

## Incident roundtrip

With a live admin/superadmin role:

1. submit a low-severity synthetic incident through `POST /pilot/admin/incidents`;
2. verify it appears in `/pilot/admin/summary`;
3. verify the incident contains an opaque operator pseudonym, not the raw citizen UUID;
4. verify the record contains the exact runtime revision or `unknown` only when the environment genuinely lacks immutable revision metadata;
5. remove/expire synthetic evidence through normal retention rather than mutating civic ledgers.

## Observation during the pilot

Review at a bounded cadence:

- unique participants approximately observed;
- failure/abandonment counts;
- recurring journey failures;
- usability/performance feedback;
- trust-and-safety feedback;
- incidents and operator action;
- `/health/pilot` state;
- runtime SHA drift;
- unexpected monetary/provider activity.

Do not turn the operational stream into behavioral scoring. Pilot telemetry must not affect reputation, ranking, voting authority, KYC status, billing entitlements or eligibility.

## Retention

Phase 7I operational data is intentionally short-lived:

- Redis keys receive a 30-day TTL;
- telemetry stream is capped at approximately 10,000 entries;
- feedback stream is capped at approximately 2,000 entries;
- incident stream is capped at approximately 500 entries.

The application must not copy these streams into a durable datastore merely to avoid expiry without a separate privacy/design review.

## STOP conditions

Pause or stop the pilot if any of the following occurs:

- `/health/pilot` becomes non-200;
- an uninvited identity can access pilot operations;
- raw citizen IDs, email, GPS or other unintended personal data appear in telemetry storage/output;
- arbitrary client payloads can bypass the enumerated schema;
- telemetry/feedback is used to alter civic authority, reputation or financial decisions;
- the dedicated telemetry pepper is missing, malformed or exposed;
- Redis operational telemetry becomes materially unavailable and pilot incidents cannot be observed;
- runtime revision cannot be tied to the candidate during an incident investigation;
- real-money capability is unexpectedly enabled;
- moderation or account deletion becomes unavailable;
- a severe security/privacy incident is detected.

## Decision record

Use one of these states:

- `BLOCKED`
- `READY_FOR_RUNTIME_VALIDATION`
- `OPERATIONAL`
- `PILOT_PAUSED`
- `PILOT_COMPLETED`

An `OPERATIONAL` decision requires successful telemetry, feedback, summary and incident roundtrips on the intended runtime. It must never be represented as market-release certification.

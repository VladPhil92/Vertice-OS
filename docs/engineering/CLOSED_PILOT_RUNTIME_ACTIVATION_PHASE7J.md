# Phase 7J — Closed Pilot Runtime Activation

## Purpose

Phase 7J turns the repository-complete Phase 7H/7I pilot controls into an operational production boundary. It does **not** open VÉRTICE to the public and it does **not** enable real-money flows.

The target state is a production runtime where all infrastructure required by the first invite-only cohort is live and observable, while cohort membership remains an explicit operator decision.

## Runtime contract

A closed pilot can be activated only when all of the following are true on the same deployed revision:

- PostgreSQL is healthy.
- Redis is healthy.
- Neo4j is healthy and reachable only through project-private networking.
- The deployed revision is a full immutable Git SHA.
- `PILOT_TELEMETRY_PEPPER` is configured with at least 32 characters.
- `CLOSED_PILOT_MODE=true`.
- `CLOSED_PILOT_EMAIL_ALLOWLIST` contains 1–30 explicit invitees.
- Payments and payouts remain disabled.
- Moderation and account deletion controls remain available.
- `/health/pilot` returns HTTP 200.
- `/pilot/status` reports the exact runtime revision and configured observability state.
- An authenticated operator can read `/pilot/admin/summary` after a Redis roundtrip.

## Infrastructure boundary

Neo4j is a required Phase 7J dependency because the first cohort exercises Community/social-graph behavior. Production Neo4j must use:

- a persistent Railway volume mounted at `/data`;
- private Railway networking;
- no public service domain;
- Bolt connectivity from the API only;
- credentials supplied through Railway variables, never committed to Git.

The API consumes:

- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `NEO4J_DATABASE`

## Privacy hardening

Production privilege certification must never write raw emails, citizen UUIDs, grantor identities, or external-provider subjects to deploy logs. Runtime evidence may contain only pseudonymous references, role/source metadata, timestamps, counts, and one-way provider-subject digests required for invariant verification.

Routine healthy boot diagnostics must use normal informational output. Error output is reserved for failures and degraded conditions so production alerting remains meaningful.

## Pilot telemetry

Pilot telemetry remains privacy-minimized:

- citizen IDs are HMAC-pseudonymized with a dedicated `PILOT_TELEMETRY_PEPPER`;
- the pepper is isolated from JWT and identity secrets;
- raw citizen IDs are not persisted in pilot streams;
- emails and GPS are not stored in pilot telemetry;
- arbitrary event payloads are not accepted;
- evidence is partitioned by exact deployed revision;
- Redis evidence uses bounded retention.

## Monetary safeguard

The closed pilot is non-monetary. The following must remain explicitly disabled during Phase 7J:

- `CROWDFUNDING_PAYMENTS_ENABLED=false`
- `CROWDFUNDING_PAYOUTS_ENABLED=false`

Provider credentials, if present for future certification work, do not override this pilot safeguard.

## Activation sequence

1. Deploy and verify Neo4j private persistence.
2. Configure API Neo4j references and pilot telemetry pepper.
3. Verify `/health/live`, `/health/ready`, `/health/release`, `/health/pilot`, and `/pilot/status`.
4. Keep `CLOSED_PILOT_MODE=false` until real invitees are selected.
5. Configure an explicit 1–30 member allowlist.
6. Set `CLOSED_PILOT_MODE=true`.
7. Re-run the exact-SHA pilot health gate.
8. Execute telemetry, feedback, operator-summary, and incident roundtrips.
9. Start the bounded cohort only after the runtime gate is green.

## Status semantics

- **INFRASTRUCTURE_READY**: Neo4j, Redis, PostgreSQL and pilot observability are operational, but the cohort boundary has not been activated.
- **READY_FOR_CLOSED_PILOT**: `/health/pilot` is green with invite-only access enabled and real-money capabilities disabled.
- **OPERATIONAL**: a real invited cohort is running and telemetry/operator roundtrips have been observed on the exact deployed SHA.

Phase 7J does not claim App Store/Play Store readiness, physical-device certification, external KYC certification, real payment certification, legal approval, or market-release certification.

# Phase 7K — Production Observability & Runtime Reliability

## Purpose

Phase 7K hardens the production runtime after the closed-pilot infrastructure work in 7J. It does not activate the pilot, enable payments, change identity authority, or bypass the pending Railway 2FA boundary for the Neo4j volume replacement.

The phase makes degradation explicit and machine-readable while preserving a fundamental invariant: a failure in an optional subsystem must not cause Railway to restart an otherwise safe core civic API.

## Health model

### `/health/live`

Process liveness only. It performs no external dependency calls.

### `/health/ready`

Serving readiness. PostgreSQL and Redis are core dependencies and can block traffic. Neo4j is observable but degradable here. This endpoint remains the Railway healthcheck contract.

### `/health/operational`

Phase 7K strict operator/canary contract. Every runtime dependency must be healthy and no release blocker may be present. It returns HTTP 503 when the system can continue serving but is not fully operational.

This separation prevents an optional dependency outage from creating a restart loop while still giving operators and release automation a strict signal.

### `/health/release`

Release promotion contract. Existing release-readiness policy remains authoritative.

### `/health/pilot`

Closed-pilot safety gate. Neo4j remains mandatory, real-money capabilities remain disabled, invitation access remains fail-closed, and an immutable production revision is required.

## Dependency evidence

Health responses expose two representations:

- `checks`: stable compatibility states (`ok` / `fail`).
- `dependencies`: bounded probe evidence with `state`, `latency_ms`, and a coarse `failure_code` (`timeout` or `unavailable`).

Raw provider errors are deliberately not returned to callers. This prevents connection strings, credentials, internal addresses, or provider-specific details from leaking through public health surfaces.

All dependency probes are bounded by the existing 2.5 second per-probe timeout and run concurrently.

## Transition-based logging

The runtime keeps an in-memory state for each dependency. Logs are emitted only when a state becomes known or changes:

- unknown → ok: initialized
- unknown/ok → fail: degraded
- fail → ok: recovered

Repeated scheduler probes with the same result do not produce duplicate dependency failure logs. Every transition is tied to the deployed revision and contains only dependency name, state and latency — never secrets or PII.

## Shutdown reliability

The existing production shutdown contract remains in force and is part of the 7K reliability boundary:

1. SIGTERM/SIGINT is handled once.
2. Duplicate shutdown signals are ignored.
3. Background jobs stop before dependency teardown.
4. Fastify stops accepting requests.
5. PostgreSQL, Redis and Neo4j clients close using settled cleanup.
6. A 15-second deadline forces a non-zero exit if draining hangs.
7. Fatal unhandled process errors exit non-zero rather than leaving a corrupted green process.

## Current Neo4j state

Phase 7K does **not** modify the staged Railway volume patch created during 7J. Production networking reaches Neo4j, but authentication remains blocked by the credential persisted in its original empty volume.

The correct replacement of that empty volume is staged in Railway and requires interactive 2FA. Until it is applied:

- `/health/ready` may remain HTTP 200 with `status=degraded` when Postgres and Redis are healthy.
- `/health/operational` must return HTTP 503 with `dependency:neo4j`.
- `/health/pilot` must remain blocked.

This is intentional fail-closed behavior.

## Safety invariants

- `CLOSED_PILOT_MODE` stays false until a real approved cohort exists.
- Crowdfunding payments stay disabled.
- Crowdfunding payouts stay disabled.
- No provider credentials or telemetry peppers are committed to Git.
- No raw dependency error messages are exposed through health endpoints.
- No staged Railway destructive change is committed by this phase.

## Release evidence

A Phase 7K candidate is code-gate complete only when the exact submitted SHA passes:

- API typecheck.
- Runtime observability unit tests.
- Existing repository CI/security gates triggered by the change.
- The Phase 7K exact-SHA workflow.

Runtime validation then requires the same SHA to deploy successfully to Railway and demonstrate the expected degraded/operational semantics without changing pilot or money safeguards.

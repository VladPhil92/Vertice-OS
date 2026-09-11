# Phase 7L — Closed Pilot Cohort Activation & Real-User Execution Boundary

## Purpose

Phase 7L introduces an explicit runtime launch control between *pilot configuration* and *real-user access*.

`CLOSED_PILOT_MODE=true` and a valid invitation allowlist are no longer sufficient to open participant pilot endpoints. The cohort must also have an active runtime activation record bound to the exact deployed Git SHA and to a privacy-preserving fingerprint of the current allowlist.

## Safety invariant

Participant traffic is permitted only when all of the following are true:

1. closed pilot mode is enabled;
2. the invitation allowlist contains 1–30 unique participants;
3. pilot telemetry privacy material is configured;
4. the deployed revision is a full immutable 40-character Git SHA;
5. PostgreSQL, Redis and Neo4j all pass bounded dependency probes;
6. no feature capability is partially configured;
7. payments and payouts remain disabled;
8. an administrator explicitly activates the exact runtime revision;
9. the activation record still matches the current cohort fingerprint and cohort size.

Any mismatch fails closed.

## Runtime drift behavior

An activation record is intentionally invalidated when:

- a new deployment changes the Git SHA;
- the invited email allowlist changes;
- the cohort size changes;
- observability configuration becomes unavailable;
- closed pilot access is disabled or becomes invalid.

This means a production deployment cannot silently inherit a previous pilot authorization.

## Operator API

### `GET /pilot/admin/activation`

Admin-only preflight surface. It can be inspected while the pilot is disabled and exposes only coarse state:

- `state`: `active` or `paused`;
- `current`: whether the activation is valid for the current runtime;
- deployed revision;
- cohort size;
- peppered cohort fingerprint;
- blocker codes;
- timestamp of the last activation-state mutation.

No participant email is returned.

### `POST /pilot/admin/activation`

Admin-only mutation with body:

```json
{
  "action": "activate | pause",
  "expected_revision": "<40-character Git SHA>"
}
```

`activate` performs a fresh strict preflight before writing the activation record. The expected revision must match the live deployed revision. `pause` is deliberately available as an emergency stop and does not require dependency health.

## Participant enforcement

`/pilot/status`, `/pilot/telemetry` and `/pilot/feedback` now enforce, in order:

1. authenticated citizen;
2. configured invite-only pilot;
3. active citizen account;
4. current invitation allowlist membership;
5. current Phase 7L runtime activation.

A stale activation returns `PILOT_RUNTIME_ACTIVATION_REQUIRED` and blocks participant execution.

## Data and privacy

The cohort fingerprint is an HMAC-SHA256 derivative using `PILOT_TELEMETRY_PEPPER` and normalized/sorted email entries. It is truncated for operational display and cannot be generated when privacy material is missing.

The activation record stores no email address and no raw citizen identifier.

## Rollback and emergency control

- Emergency pause: administrator sends `action=pause`.
- Code rollback: revert the Phase 7L merge; no database migration is involved.
- Redis activation state is non-authoritative unless the current SHA and cohort fingerprint match, so stale records are safe by construction.

## External boundary

Phase 7L code readiness does **not** activate real users by itself. Production activation still requires:

- a healthy Neo4j runtime;
- a real tester allowlist supplied by the operator;
- explicit administrative activation against the deployed SHA.

No real-money capability is enabled by this phase.

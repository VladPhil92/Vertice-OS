# Phase 5 — Production Hardening

## Objective

Phase 5 hardens the VÉRTICE OS API runtime before the Cartagena pilot. It does not add new business features. Its purpose is to make release decisions deterministic, fail closed on unsafe partial configuration, and preserve availability when optional dependencies degrade.

## Runtime health contract

The API exposes three distinct health levels:

| Endpoint | Purpose | Network dependency probes | Failure semantics |
| --- | --- | --- | --- |
| `/health/live` | Process liveness | None | 200 while the HTTP process can answer |
| `/health/ready` | Serving readiness | Postgres, Redis, Neo4j | 503 only when a core dependency (Postgres/Redis) fails; Neo4j can degrade |
| `/health/release` | Promotion/release readiness | Same runtime probes + capability policy | 503 for core dependency failure, any `misconfigured` capability, or an unknown production revision |

`/health` remains as a backward-compatible liveness endpoint.

### Critical vs. degradable dependencies

- **Postgres:** critical. Failure blocks serving and release.
- **Redis:** critical. Failure blocks serving and release because rate limits, sessions/coordination and other runtime contracts depend on it.
- **Neo4j:** degradable. Failure is observable as `degraded` but does not take the base civic API offline.

This classification is centralized in `apps/api/src/lib/runtime-readiness.ts` and covered by deterministic unit tests.

## Feature configuration policy

Feature capabilities retain the existing three-state model:

- `ready`: configured and internally available.
- `disabled`: intentionally absent; does not block a release.
- `misconfigured`: partially configured or internally inconsistent; **blocks `/health/release`**.

This distinction is especially important for payments, payouts, civic identity assurance, blockchain and other high-impact capabilities. A disabled provider does not disable free civic participation. A partially configured provider cannot be silently promoted.

Financial/KYC/subscription/payout state remains structurally separated from civic reputation, ranking, governance authority, voting weight and organic reach.

## Revision traceability

In `NODE_ENV=production`, `/health/release` requires an immutable deployment revision from one of the supported deployment SHA variables. `revision: unknown` blocks promotion.

This means runtime evidence can be tied to the exact source SHA. It does **not** mean a source-level CI run proves that the same SHA has been deployed.

## Shutdown contract

The API now treats `unhandledRejection` and `uncaughtException` as fatal process conditions rather than continuing in an unknown state.

For SIGTERM/SIGINT:

1. the shutdown path is idempotent;
2. the job worker is stopped;
3. Fastify stops accepting traffic and drains requests;
4. Postgres, Redis and Neo4j cleanup is attempted;
5. cleanup failures produce a non-zero exit;
6. a 15-second internal deadline forces a non-zero exit if draining hangs.

The Kubernetes API deployment reserves 30 seconds before SIGKILL, exceeding the internal shutdown deadline.

## Kubernetes probe alignment

- liveness → `/health/live`
- readiness → `/health/ready`
- `terminationGracePeriodSeconds` → 30

`/health/release` is deliberately **not** a Kubernetes readiness probe. Release readiness is stricter than traffic readiness; using it as a pod readiness probe would unnecessarily remove the base civic API from service when an optional capability is partially configured.

The current Kubernetes manifest still contains an explicit `:latest` placeholder with an instruction to replace it with a versioned tag/digest. Therefore this Phase 5 source change does not certify that Kubernetes manifests are production-deployable as-is.

## CI release gate

`.github/workflows/production-hardening.yml` validates the exact PR SHA by running:

1. locked dependency install;
2. `pnpm hardening:verify` static contract verification;
3. shared types build;
4. API typecheck;
5. targeted runtime health/readiness tests;
6. API build.

A green workflow establishes **IMPLEMENTED source-level runtime hardening** for that SHA.

## Status semantics

- **IMPLEMENTED:** Phase 5 code exists on a branch and its exact SHA gates are green.
- **INTEGRATED:** that reviewed SHA is merged into `main`.
- **DEPLOYED:** the same source revision is confirmed in a running environment.
- **READY:** production runtime `/health/release` is green with required environment/configuration evidence.
- **CERTIFIED:** required external provider canaries and release evidence have also passed.

Merging this phase alone must never be described as DEPLOYED, READY or CERTIFIED.

## Explicitly out of scope

- external Mercado Pago/Wompi certification;
- external civic identity provider certification;
- app-store/mobile device certification;
- GitHub branch-protection administration;
- load/soak testing against a production-like environment;
- pilot operational playbooks and incident drills.

Those remain separate evidence domains for later pilot readiness.

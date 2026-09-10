# Cartagena Pilot Runbook — Phase 6

Phase 6 converts VÉRTICE OS from a production-deployed codebase into an auditable candidate for a **controlled Cartagena pilot**. It does not add product features. It adds same-SHA runtime evidence, a repeatable GO/NO-GO decision and an explicit rollback procedure.

## Scope

The automated runtime canary is intentionally non-destructive. It uses only public `GET` requests against:

- `/health/live`
- `/health/ready`
- `/health/release`
- `/territorial/reports?limit=1`
- `/governance/proposals?limit=1`

No pilot gate creates users, reports, proposals, votes, donations, payments, payouts or identity-assurance events.

The canary waits for production to expose the exact expected Git revision before evaluating readiness. This prevents a green result from an older Railway deployment being reused as evidence for a newer source revision.

## Same-SHA evidence

A Phase 6 runtime decision is valid only when all of the following refer to the same immutable Git SHA:

1. the revision merged to `main`;
2. the revision returned by `/health/live`;
3. the revision returned by `/health/ready`;
4. the revision returned by `/health/release`;
5. the revision recorded in the `Cartagena Pilot Readiness` workflow artifact.

The workflow polls production for up to 10 minutes after a `main` push to tolerate normal Railway build/deploy time. A timeout is a NO-GO; it must never silently fall back to the previous deployment.

## GO criteria

The **technical runtime GO** for the controlled pilot requires all of these conditions:

- source CI for the exact revision is green;
- the production canary observes the exact expected SHA;
- `/health/live` returns `200`, `status=ok` and the expected revision;
- `/health/ready` returns `200` with Postgres and Redis checks `ok`;
- `/health/release` returns `200`, `status=ready`, an empty blocker list, and the expected revision;
- three consecutive non-destructive canary rounds succeed;
- public territorial reads return `200` with the expected list contract;
- public governance reads return `200` with the expected list contract;
- every measured canary response remains within the configured 4-second ceiling;
- the machine-readable `pilot-canary-report.json` artifact is retained for the release SHA;
- no unresolved P0/P1 review finding exists for the pilot change.

Neo4j is currently an optional dependency by the Phase 5 runtime contract. Its degradation can produce `serving_status=degraded` without blocking the controlled pilot, provided Postgres + Redis remain healthy and `/health/release` has no blockers. Features that genuinely depend on Neo4j must be evaluated separately before they are included in the pilot script.

## NO-GO criteria

Any one of the following forces NO-GO:

- production still exposes an older or unknown revision after the deployment window;
- Postgres or Redis is unavailable;
- `/health/release` reports any blocker;
- any optional capability is partially configured and therefore marked `misconfigured`;
- a canary endpoint returns a non-2xx result, invalid JSON or an incompatible response contract;
- the latency ceiling is exceeded in any canary sample;
- Golden E2E, security, runtime or core CI gates fail for the candidate SHA;
- a new P0/P1 review finding is unresolved;
- operators cannot identify a previous known-good deployment for rollback.

A NO-GO does not mean the entire civic API must be shut down. Phase 5 deliberately separates serving readiness from release readiness. Existing safe civic traffic may continue while promotion of the new pilot revision is blocked.

## Rollback

Rollback is release-level, not destructive database reversal.

1. Stop pilot expansion and record the failed SHA plus the canary artifact.
2. Prefer redeploying the immediately previous Railway deployment that was known healthy, or revert the offending Git commit and allow the normal `main` deployment path to rebuild it.
3. Confirm the restored deployment reports its own revision on `/health/live`.
4. Require `/health/ready` to return `200` before resuming traffic expansion.
5. If the failure involved a database migration, do not run an ad-hoc down migration. Use a forward repair migration unless an explicitly reviewed reversible migration procedure exists.
6. Re-run the pilot canary against the restored SHA and retain the resulting evidence.

Phase 6 itself introduces no database schema migration and no financial mutation.

## Observability and incident triggers

During the controlled pilot, operators should watch:

- Railway deployment status and runtime logs;
- `/health/ready` and `/health/release` state changes;
- 5xx responses and sustained latency growth;
- Sentry/server exceptions where configured;
- failed or replayed financial/idempotent operations in their dedicated operational tooling;
- the `Cartagena Pilot Readiness` artifact for every promoted SHA.

Immediate pilot freeze is warranted for authentication bypass, authorization escalation, cross-user data exposure, vote duplication, money double-processing, integrity loss, persistent 5xx errors or inability to determine the active revision.

## Branch protection

`main` is protected by the active repository ruleset `Golden Main Protection`.

The effective policy requires:

- pull request before merge;
- seven required GitHub Actions checks;
- branch up to date before merge;
- all review conversations resolved;
- squash or rebase merge only;
- no bypass actors;
- branch deletion blocked;
- non-fast-forward/force-push blocked.

The policy was verified operationally with PR #148: GitHub rejected a merge while a review conversation was unresolved and allowed the squash merge only after conversations were resolved and required checks were green. GitHub reports `main.protected = true`.

This protection complements the same-SHA runtime gate; neither mechanism replaces the other.

## External-provider boundary

A green Phase 6 runtime canary does not certify Mercado Pago, Wompi, Veriff, CTG One federation, push delivery, Cloudflare Images, app-store distribution or any other external provider. Each provider keeps its own READY/CERTIFIED boundary and must fail closed when required credentials or certification evidence are absent.

Money, subscription, KYC/KYB and payout state must never alter civic reputation, ranking, governance authority, vote weight or organic reach.

## Release-state interpretation

- **IMPLEMENTED** — Phase 6 source contract and canary exist on a candidate branch.
- **INTEGRATED** — the Phase 6 PR is merged to `main`.
- **DEPLOYED** — Railway reports a successful deployment for that merge SHA.
- **READY (controlled pilot)** — the post-deploy same-SHA canary returns GO and its artifact is retained.
- **CERTIFIED / GA** — not established by Phase 6; external-provider certification, broader operational evidence and remaining governance controls still apply.

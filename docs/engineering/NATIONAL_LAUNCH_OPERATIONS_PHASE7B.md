# Phase 7B — National Launch & City Activation Operations

## Objective

Turn the Phase 7A national territory model into an auditable rollout operating system. VÉRTICE can observe every Colombian municipality/district, identify nodes with genuine civic traction, recruit an operational cohort, determine launch readiness, launch or pause a node, and retain a durable transition history.

This phase is **operations**, not civic authority.

## Authority boundary

The following never grant authorization, identity assurance, territory assurance, reputation, governance eligibility, vote weight or organic reach:

- launch readiness score;
- activation/operational state;
- ambassador, organizer or observer cohort labels;
- launch target completion;
- being selected as a candidate city.

Authorization remains exclusively in live `citizen_role_grants` + session activation. Governance eligibility remains governed by civic identity assurance + territory assurance + frozen voter-roll constraints.

## Signals used

Readiness may use only civic/operational evidence:

- active citizens (30d);
- distinct civic-action creators (30d);
- verified civic actions (90d);
- evidence completion rate;
- territorial report resolution rate;
- public social leaders / organization representatives in the node;
- live moderation capacity;
- active launch-cohort participation.

Explicitly excluded: payments, donations, crowdfunding volume, payouts, subscription tier, KYC/KYB state, personal wealth, ideology, candidate preference and reputation-based political weighting.

## Operational states

`observing → recruiting → launch_ready → launched`

Any node may move to `paused`. Pausing is non-destructive: it does not delete citizens, actions, reports, proposals, evidence, assurance or history.

`launched` is fail-closed: the backend rejects the transition while readiness blockers exist.

## Readiness blockers

Default launch targets:

- 10 active citizens / 30d;
- 3 verified actions / 90d;
- 2 local leaders;
- 1 live moderator/admin/superadmin in the territory.

Targets are operational configuration and may be adjusted by superadmin. The score is not sufficient by itself: mandatory blockers must also be clear.

## Data model

- `territory_launch_plans`: current operational plan and targets.
- `territory_launch_cohort_members`: operational cohort labels only.
- `territory_launch_events`: immutable transition ledger with metrics snapshot.
- `admin_audit_log`: cross-module administrative audit record.

Cartagena is bootstrapped as `launch_ready` because it is the Phase 6 pilot and Phase 7A `pilot_ready` node. This does not imply GA certification.

## API

Mounted under `/territories/admin/operations`:

- `GET /board` — live admin; national set-based operations board.
- `GET /:code` — live admin; one city's launch plan/readiness.
- `PUT /:code` — live superadmin; update plan/state/targets with mandatory reason.
- `POST /:code/cohort` — live superadmin; assign ambassador/organizer/observer label to a citizen already in that territory.

## Scale contract

The national board is one set-based PostgreSQL query using CTEs. It must not execute a loop of per-city metric queries after full DIVIPOLA synchronization.

## Web control plane

`/dashboard/admin/national` provides:

- national readiness ranking;
- launched / ready / blocked counts;
- city-level blockers;
- evidence and resolution indicators;
- local leadership and moderation capacity;
- auditable launch/pause transitions.

The launch action is disabled client-side when readiness is blocked, while the API remains the authoritative fail-closed control.

## Release states

- `IMPLEMENTED`: migration + API + web + tests + verifier are present on a branch.
- `INTEGRATED`: merged to `main` with exact-SHA gates green.
- `DEPLOYED`: the merged SHA is running in production.
- `READY`: production health + national board smoke + Cartagena and at least one non-Cartagena node smoke pass.
- `CERTIFIED`: reserved for external/provider evidence where applicable; Phase 7B does not certify DANE availability by itself.

## Rollback

Application rollback is a merge-revert. The migration is additive; launch-plan/event/cohort tables may remain safely if an older runtime is restored. Never delete civic history to roll back an operational launch state. A paused node preserves all records.

## Known external/manual debt

- `main` branch protection remains an administrative repository setting and is not made true by this phase.
- Real DANE availability/canary remains separate from internal rollout readiness.

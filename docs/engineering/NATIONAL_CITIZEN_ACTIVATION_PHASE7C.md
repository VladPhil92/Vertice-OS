# Phase 7C — National Citizen Activation & Public City Experience

## Purpose

Phase 7A made VÉRTICE territorially national. Phase 7B added the internal launch-operations control plane. Phase 7C exposes a safe public city experience and a voluntary citizen activation workflow so people can discover local civic activity and offer operational help without receiving authority by implication.

## Public city experience

- `/cities` is the national discovery surface.
- `/cities/[code]` renders one municipality/district from the canonical territorial API.
- `GET /territories/public/:code` exposes aggregate-only activation and launch signals plus the public territorial feed.
- Operator-only blockers, moderation capacity, launch targets, notes and audit actors are never exposed through the public projection.
- Momentum and public activation state exclude payments, donations, payouts, subscriptions, KYC/KYB, economic capacity and ideology.

## Citizen activation workflow

A citizen whose current self-selected territory matches the target municipality/district may submit an interest as:

- `ambassador`
- `organizer`
- `observer`

Lifecycle:

`pending → approved | declined | withdrawn`

The citizen may withdraw their own expression. Admins may inspect a territory queue. Review mutation requires a live superadmin session.

### Critical authority boundary

An interest row is an operational expression only. Neither submission nor approval:

- creates a `citizen_role_grants` record;
- assigns a Phase 7B cohort member automatically;
- changes identity assurance;
- changes territory assurance;
- changes reputation or ranking;
- changes governance eligibility or frozen voter rolls;
- changes vote weight or organic reach.

A later cohort assignment remains the existing separate Phase 7B superadmin operation and still has `authority_effect: none`.

## Data model

`territory_activation_interests` is a durable, auditable ledger keyed uniquely by territory + citizen + interest role. It stores the requested operational role, review state, optional short message and reviewer metadata. It intentionally contains no authorization or assurance fields.

## Security and privacy

- citizen submission/withdrawal requires authentication;
- target territory must equal the citizen's current territorial node;
- public pages expose aggregate counts, not interest identities;
- admin queue exposes stable citizen IDs and minimal civic-profile metadata, not email, phone or financial/KYC data;
- review requires superadmin authority;
- withdrawn records cannot later be approved without a new citizen submission;
- all citizen and review mutations emit audit events;
- financial/KYC state is not queried by this feature.

## Release semantics

- **IMPLEMENTED**: code, schema, tests, web journeys and source contract are present on a branch.
- **INTEGRATED**: the exact reviewed SHA is merged into `main` with required checks green.
- **DEPLOYED**: Railway confirms the exact merge SHA successfully deployed.
- **READY**: the deployed SHA also passes same-SHA runtime smoke for public city reads and authenticated interest submit/read/withdraw in a controlled account.
- **CERTIFIED**: requires real operational evidence from a controlled launch cohort; source tests or a merge do not establish this state.

## Rollback

The Phase 7C migration is additive. Application rollback may leave `territory_activation_interests` in place because no legacy path depends on it. Do not delete the table during emergency application rollback. A later cleanup, if ever needed, must be an explicit migration after confirming no deployed revision reads it.

## Remaining external/manual controls

- GitHub `main` branch protection remains an administrative control outside this phase.
- National public launch communications and real cohort staffing remain operator decisions.
- A citizen's self-selected territory remains personalization context; it does not become verified residence through Phase 7C.

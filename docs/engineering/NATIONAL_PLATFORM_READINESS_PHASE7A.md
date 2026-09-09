# Phase 7A — National Platform Readiness

Status: IMPLEMENTED on candidate branch. This document does not by itself promote the release to INTEGRATED, DEPLOYED, READY or CERTIFIED.

## Product boundary

VÉRTICE is a national civic platform for Colombia. Cartagena de Indias is the first runtime-certified pilot territory, not a separate product and not the geographic limit of the network.

The territorial model is designed as:

`Colombia → department → municipality/district → locality/commune → neighborhood/vereda`

Official department and municipality identifiers use DANE/DIVIPOLA codes when available. Community sub-territories remain VÉRTICE-managed identifiers unless an authoritative official identifier is explicitly available.

## Phase 7A scope

- national territory hierarchy with stable internal codes and optional DIVIPOLA external codes;
- backward-compatible mapping of Cartagena legacy `localities` into the national hierarchy;
- primary municipality/district binding for citizens, reports, proposals and civic actions;
- City Activation Engine driven only by civic/community activity signals;
- public discovery of municipality/district activation state and momentum;
- citizen self-selection of a primary municipality/district without changing identity assurance or reputation;
- superadmin-only operational activation state changes with audit provenance;
- best-effort DANE/DIVIPOLA catalog synchronization that never becomes a serving-readiness dependency;
- governance electorate isolation for city/regional scopes so national rollout cannot accidentally create a countrywide electorate for a city proposal.

## Activation states

Municipal/district nodes use five operational states:

1. `available` — VÉRTICE accepts residents and civic activity.
2. `emerging` — early local density exists.
3. `community_active` — recurrent local civic activity exists.
4. `pilot_ready` — the territory is a candidate for deep operational validation.
5. `verified_network` — sustained operational evidence exists after explicit review.

The engine computes a recommendation score; it never silently promotes a territory. Operational state changes are explicit superadmin actions and are auditable.

## Civic-neutral scoring invariant

Activation scoring may use counts of citizens, active citizens, civic actions, verified civic actions, territorial reports and proposals. It MUST NOT use subscription tier, payment volume, donation amount, payout/KYC/KYB status, wealth, financial activity, or civic reputation as political authority.

City activation is a product/operations signal, never a grant of governance authority.

## Governance migration rule

Legacy Cartagena `locality_id` remains valid for locality and neighborhood governance. A new `territory_code` snapshots the municipality/district of the author.

For proof-backed frozen voter rolls:

- `neighborhood`: same municipality + same neighborhood;
- `locality`: same municipality + same legacy locality;
- `city`: same municipality/district;
- `regional`: same parent department;
- `national`: all proof-assured Colombian citizens.

This preserves one-person/one-effective-vote semantics while preventing a city proposal in Medellín, Bogotá or Cartagena from accidentally drawing an electorate from the whole country.

## Catalog source

DANE/DIVIPOLA is authoritative for department and municipality/district codes. Runtime availability of DANE is not required to serve VÉRTICE. Production may refresh the catalog best-effort after startup; failures are logged and retried by later refreshes without blocking `/health/ready` or `/health/release`.

## Cartagena bootstrap

The migration seeds Colombia, all Colombian department-level DIVIPOLA nodes, initial municipality/district nodes for major cities, Cartagena de Indias (`13001`) as `pilot_ready`, and legacy Cartagena localities as children of Cartagena. Existing Cartagena citizens/actions/reports/proposals are backfilled to municipality `13001` when their legacy locality indicates Cartagena.

The DANE refresh subsequently expands the municipality catalog nationally.

## Release semantics

- **IMPLEMENTED** — schema, API, activation engine and verification contract exist on a candidate branch.
- **INTEGRATED** — the Phase 7A PR is merged to `main` after exact-SHA gates pass.
- **DEPLOYED** — Railway successfully runs the merged SHA and applies the migration.
- **READY (national availability)** — production exposes the national catalog, existing Cartagena data remains coherent, and at least one non-Cartagena municipality can be selected without changing civic authority.
- **CERTIFIED / GA Colombia** — not established by this phase; broader scale, provider certification, branch protection and operational evidence remain separate gates.

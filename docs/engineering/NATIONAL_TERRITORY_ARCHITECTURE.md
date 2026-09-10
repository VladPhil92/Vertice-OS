# National Territory Architecture

## Purpose

VÉRTICE is a Colombian national civic platform. A citizen can have a durable civic home and still travel, browse, report, organize and contribute in any Colombian municipality or district. Geographic context is therefore modeled as three different concepts rather than one mutable `city` field.

## Core invariant

**Home territory != active territory != contribution target.**

Example: a citizen registered in Cartagena travels to Medellín.

- Home territory remains `CO-MP-13001` (Cartagena de Indias).
- GPS or an explicit context switch may set active territory to `CO-MP-05001` (Medellín).
- A report or civic action created in Medellín snapshots `CO-MP-05001` as its contribution target.
- Returning to Cartagena or changing active context never rewrites the historical Medellín contribution.
- None of these product-context changes grants residency assurance, governance authority or voting eligibility in Medellín.

## 1. Home territory

Storage: `citizens.territory_code`.

Meaning: durable, self-asserted civic affiliation used for profile defaults and onboarding. It is managed through `/territories/me` and does not automatically change because the device moves.

Home territory is not sufficient evidence for residency-sensitive governance. Existing identity/territory assurance rules remain the authorization boundary.

## 2. Active territory context

Storage: `citizen_territory_contexts`.

Meaning: transient product context describing where the citizen is currently operating. It can be selected manually or inferred from device geolocation.

API:

- `GET /territories/context`
- `PUT /territories/context`

The active context stores only a canonical Colombian municipality/district code, provenance (`manual` or `gps`) and update timestamp. Raw GPS coordinates are deliberately not persisted in this context table.

If no active context exists, the API exposes home territory as a non-persisted `home_fallback`. This preserves useful defaults without pretending the platform knows the citizen's current physical location.

## 3. Contribution target

Storage:

- `territorial_reports.territory_code`
- `civic_actions.territory_code`

Each new national client explicitly sends the municipality/district to which the contribution belongs. The target is an immutable creation-time snapshot and may differ from both home and active context.

Examples:

- Cartagena citizen physically in Medellín reports a damaged road in Medellín: target Medellín, source `gps` or `manual`.
- Cartagena citizen remotely supports an action in Cali: target Cali, source `manual`.
- A user outside Colombia may still contribute to a Colombian civic action by manually choosing its Colombian target. Current foreign GPS coordinates must never be silently mapped to a Colombian municipality.

For backward compatibility, old callers that omit `territory_code` continue to snapshot the citizen home territory. Such records are marked `legacy_home_fallback`; new clients must not rely on that fallback.

## Canonical geography

All contribution targets must resolve to a canonical `territories` row with:

- `country_code = CO`
- level `municipality` or `district`
- stable VÉRTICE code and DANE/DIVIPOLA `external_code` when available

Free-text city names are not persisted as the geographic authority. Neighborhood and address text remain descriptive subdivisions of a canonical municipal target.

## Geolocation behavior

Mobile geolocation is opt-in and assistive:

1. Request foreground location only when the citizen asks to use GPS.
2. Obtain device coordinates for proximity/report location.
3. Reverse-geocode locally through the device location provider.
4. Match the resulting Colombian place name against the VÉRTICE DANE/DIVIPOLA catalog.
5. Suggest the matching canonical municipality/district.
6. Allow the citizen to correct the target manually.
7. Persist only the canonical active territory in `citizen_territory_contexts`; report coordinates remain attached to the report itself.

If location permission is denied, the contribution flow remains usable with manual municipality and coordinates. GPS is never a prerequisite for civic participation.

## Geographic validation boundaries

The API validates canonical national membership server-side. Explicit report coordinates also pass a coarse Colombia envelope sanity check to reject obviously foreign coordinates.

This envelope is **not** municipal point-in-polygon validation and must not be represented as such. A later hardening phase should ingest authoritative DANE municipal boundary geometries into PostGIS and verify that a report point intersects the selected municipality/district geometry, including a documented border tolerance policy.

## Governance boundary

Mobility is a participation feature, not an authorization shortcut.

- Active territory does not grant local governance authority.
- Creating a report/action in another city does not establish residency.
- Home territory remains self-asserted unless separately assured.
- Territory assurance, voter-roll rules, identity assurance and role authorization remain independent controls.

## Privacy boundary

The platform must not build a passive movement history from active context. The context table stores one current canonical territory per citizen and overwrites it on change. Exact device coordinates are not stored there.

Report coordinates are retained only because the location of the reported civic event is part of the report record itself.

## Compatibility and migration

The Phase 7A snapshot triggers are retained and hardened:

- explicit target wins;
- explicit target defaults provenance to `manual` if omitted by a direct DB caller;
- missing target falls back to home only for legacy compatibility and is labeled `legacy_home_fallback`;
- historical rows are not moved when a citizen changes home or active context.

## Acceptance scenarios

The national architecture is correct when these scenarios hold:

1. Cartagena home -> Medellín active -> Medellín report: home stays Cartagena; report stays Medellín.
2. Cartagena home -> manually selected Cali civic action: action belongs to Cali without changing home.
3. GPS denied -> manual Bucaramanga selection: contribution remains possible.
4. GPS outside Colombia -> no silent Colombian assignment; manual Colombian target remains available.
5. Department/country/locality node supplied as contribution target -> rejected; municipality/district required.
6. Citizen later changes active context -> historical report/action territory is unchanged.
7. Active context alone -> no additional governance or voting privileges.

## Next hardening phase

The next geographic integrity layer should add DANE municipal polygons to PostGIS, point-in-polygon verification, border ambiguity handling, canonical department/municipality labels in all feeds, and territorial analytics based on explicit contribution targets rather than citizen home affiliation.

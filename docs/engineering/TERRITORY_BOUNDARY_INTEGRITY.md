# Phase 7F — Territory Boundary Integrity

## Objective

Move national report geography from a coarse Colombia envelope plus name matching to an authoritative, auditable municipal/district boundary contract based on DANE MGN polygons stored in PostGIS.

The core product invariant remains:

`home territory != active territory != contribution target`

This phase strengthens the **contribution target** only. It does not turn GPS into residency evidence and does not grant governance or voting authority.

## Authoritative source

VÉRTICE synchronizes municipality/district geometry from DANE's DIVIPOLA / Marco Geoestadístico Nacional 2025 municipality FeatureServer (layer 317). Geometry is requested as GeoJSON in EPSG:4326 and normalized into PostGIS `MultiPolygon` values.

The boundary table stores:

- canonical `territory_code`;
- normalized polygon geometry;
- provider and source version;
- SHA-256 checksum of the received geometry;
- computed area;
- synchronization timestamp.

The system does **not** use this table as a citizen movement-history store.

## Server-authoritative point resolution

`POST /territories/resolve`

Request body:

```json
{
  "lat": 10.391,
  "lng": -75.479,
  "tolerance_m": 150
}
```

Exact coordinates are deliberately carried in the JSON body rather than query parameters so request-URL/error telemetry cannot become an accidental GPS history.

Possible results:

- `matched`: the point is covered by exactly one canonical municipal/district polygon;
- `near_border`: no polygon covers the point, but exactly one is within the documented tolerance;
- `ambiguous_border`: multiple polygons overlap or are within tolerance; the server refuses to guess;
- `outside_colombia`: the point fails the defensive Colombia envelope before polygon lookup;
- `catalog_unavailable`: no complete synchronized boundary catalog is available for an otherwise unresolved point;
- `unresolved`: a complete boundary catalog exists but no candidate can be resolved.

Mobile uses this server resolver before device reverse geocoding. Device reverse geocoding remains an availability fallback only while the polygon catalog is unavailable or the resolver is degraded.

## Report creation enforcement

For a report with an explicit `territory_code`, the API validates the point against that territory's polygon before insertion.

Creation-time `territory_validation` values are:

- `polygon_verified`: point is covered by the selected polygon;
- `border_tolerance`: point is outside the polygon but within 150 metres of its boundary;
- `catalog_unavailable`: that selected territory has no synchronized polygon yet, so the existing national envelope remains the temporary fallback;
- `legacy_unverified`: historical/backward-compatible path without an explicit target.

If a polygon exists and the point is farther than the tolerance from the selected territory, the API rejects the write with `REPORT_TERRITORY_COORDINATE_MISMATCH`.

The boundary source version used in verification is snapshotted into `territorial_reports.territory_boundary_version` for later auditability.

## Border policy

The default tolerance is **150 metres**. This exists to absorb ordinary civilian GPS error, cartographic simplification and edge effects near municipal boundaries. It is not a mechanism to silently select between two plausible municipalities.

When more than one candidate is plausible, automatic GPS assignment returns `ambiguous_border` and the citizen must select the contribution territory explicitly.

## Canonical labels and analytics

Territorial report feeds expose canonical municipality/district and department labels from the `territories` tree instead of relying on free-text city labels. Territory-specific feeds attach the same canonical geography to actions, reports and proposals.

Territorial report analytics include a `by_territory` projection grouped by the contribution's immutable `territory_code`. They do not group civic activity by the citizen's home territory.

## Synchronization operations

Superadmin operations:

- `GET /territories/admin/boundaries/status`
- `POST /territories/admin/sync-boundaries`

A successful synchronization requires every valid municipality/district feature in the received DANE snapshot to stage and publish successfully. The incoming feature set is validated for invalid geometry and duplicate municipality codes before publication.

Publication uses a transaction-local staging table. Readers therefore see either the previous complete DANE catalog or the new complete DANE catalog; a partially updated national set is never exposed as successful. A sync run is marked `succeeded` only when `features_upserted == features_seen`, the live DANE boundary count equals that same expected count, and the baseline completeness threshold is met.

The status endpoint reports the expected feature count from the latest successful synchronization and exposes `point_in_polygon_ready=true` only when the live DANE catalog still exactly matches that completed snapshot. Repository tests use deterministic synthetic polygons and never require the external DANE service to be online.

## Privacy and governance boundaries

- Exact GPS coordinates are not persisted in `citizen_territory_contexts`.
- Exact GPS coordinates used only for territory suggestion are not placed in request URLs.
- Report coordinates remain part of a report because they describe the civic event itself.
- Polygon matching does not prove residence.
- Home territory remains self-asserted unless separately assured.
- Active context and report target do not modify voter eligibility or governance authority.

## Release boundary

Code, migration, deterministic integration tests and the synchronization mechanism can be certified in CI. **National polygon coverage is not certified until an authorized operator runs the production boundary synchronization and the status endpoint reports a complete MGN catalog with `point_in_polygon_ready=true`.**

Production rollout therefore requires:

1. apply the Phase 7F migration;
2. run the existing DIVIPOLA catalog sync if needed;
3. run `POST /territories/admin/sync-boundaries`;
4. verify `point_in_polygon_ready=true` and confirm `boundary_count == expected_feature_count` with the expected source version;
5. run bounded physical-device tests in an interior municipal point, a known border area and a deliberately mismatched municipality.

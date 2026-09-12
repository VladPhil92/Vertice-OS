# Phase — Public City & Report Domain Convergence

## Objective

Converge the public city node and territorial report detail on the canonical VÉRTICE native product language while preserving their public-read and authority boundaries.

This tranche follows Territory Trust Surface Convergence. Territory selection, activation and residence assurance were already canonical, but citizens could still cross into a public city node or report detail and encounter the retired beige/green layer, raw system typography and non-semantic navigation.

## Runtime delivered

### Public city node

`apps/mobile/app/city/[code].tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter/DM Mono aliases, VÉRTICE brand assets and semantic Lucide icons.

The city node now presents activation maturity, civic momentum, participation metrics and public activity through the same semantic hierarchy used elsewhere in VÉRTICE. The visual momentum bar is clamped to its 0–100 visual contract, and public report activity can deep-link directly to the canonical report detail route.

The endpoint remains public and unchanged. Momentum remains a discovery signal; it does not create authority, identity assurance, residence assurance, reputation weight or governance eligibility.

### Territorial report detail

`apps/mobile/app/report/[id].tsx` now separates report status, location, urgency signal, evidence and traceability into canonical cards and semantic states. Coordinates use the bundled DM Mono alias, image evidence has accessibility labels, and the external map handoff remains explicit.

Report status continues to come from the existing public backend contract. The client does not promote a report into an official decision, infer identity or residence, or award reputation from presentation alone.

## Icon boundary extension

`apps/mobile/components/VerticeIcon.tsx` now exposes semantic names for this domain tranche:

- `report`
- `map`
- `evidence`
- `timeline`
- `refresh`
- `signal`

Lucide ownership remains centralized in the adapter; product screens do not import icon families directly.

## Regression gate

`apps/mobile/scripts/verify-city-report-surfaces.mjs` certifies both surfaces. It fails if a migrated screen:

- loses the canonical theme adapter;
- loses the VÉRTICE brand or Lucide boundary;
- reintroduces local hexadecimal colors;
- restores Unicode glyphs as navigation/status icons;
- introduces a raw font-family string;
- uses a semantic typography role without its bundled font alias;
- removes the public city or report read contract;
- removes the city-to-report deep link;
- removes DM Mono from geographic coordinates;
- removes the explicit external map handoff.

The gate is chained into Mobile Core Parity through `verify-font-alias-contract.mjs`.

## Authority boundaries

This phase changes presentation and navigation-shell behavior only. It does not change:

- territory activation scoring inputs;
- city momentum calculation;
- report moderation or status decisions;
- identity or residence assurance;
- reputation or ranking;
- governance eligibility or voter rolls;
- payments, donations or crowdfunding authorization.

## Next tranche

After this phase, the remaining legacy secondary domain surfaces are community detail/moderation, workflows and crowdfunding. They should be migrated as separate domain tranches because each has distinct moderation, authority and financial semantics.

## Release certification

This phase is certified only when the exact PR head passes the applicable repository gates, including Mobile Core Parity, native typecheck, Android/iOS export assertions, Mobile Domain Parity, Golden API/Browser journeys, security scans and repository CI. Passing source and export checks does not constitute App Store or Play Store publication or physical-device validation.

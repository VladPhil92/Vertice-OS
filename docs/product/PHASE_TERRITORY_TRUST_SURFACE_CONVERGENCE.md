# Phase — Territory Trust Surface Convergence

## Objective

Converge the three native territory trust surfaces — primary territory selection, community activation and residence assurance — on the canonical VÉRTICE product language without changing any backend authority, eligibility, reputation or governance decision.

This tranche follows the Critical Secondary Surface Convergence phase. Territory flows were still visually anchored in the retired beige/green layer even though authentication, primary navigation, notifications, privacy and identity assurance already used the canonical navy/yellow/red runtime.

## Runtime delivered

### Primary territory selection

`apps/mobile/app/territory/select.tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter/DM Mono aliases, VÉRTICE brand assets and semantic Lucide icons. Search, empty states, activation status pills and territory selection controls now share the same interaction contract as the rest of the mobile product.

The functional boundary is unchanged: choosing a municipality or district still calls the existing primary-territory mutation and then routes to territory activation. The selection remains self-declared and does not create residence assurance or governance eligibility.

### Community activation

`apps/mobile/app/territory/activate.tsx` now presents voluntary local participation through canonical cards, status semantics, typography, brand imagery and semantic icons. Pending, approved, declined and withdrawn manifestations receive explicit semantic states without changing their backend meaning.

Role-interest creation and withdrawal endpoints remain unchanged. Approval still does not create a cohort assignment, reputation, authority or governance permission.

### Residence assurance

`apps/mobile/app/territory/assurance.tsx` now separates self-declared territory, verified residence and governance effects using canonical semantic states. Pending review, effective verification, renewal and expiration use information, success, warning and error tokens instead of local colors.

Evidence submission rules and authority boundaries are unchanged. The native client does not infer voter eligibility; it only presents backend assurance state and submits opaque evidence references through the existing contract.

## Regression gate

`apps/mobile/scripts/verify-territory-trust-surfaces.mjs` certifies all three surfaces. It fails if a territory trust screen:

- loses the canonical theme adapter;
- loses VÉRTICE brand or Lucide boundaries;
- reintroduces local hexadecimal colors;
- restores Unicode arrow/check/circle glyphs as interface icons;
- introduces a raw font-family string;
- uses a semantic typography role without the matching bundled font alias;
- removes the existing primary-territory, activation-interest or assurance-request contracts.

The gate is chained into the Mobile Core Parity path through `verify-font-alias-contract.mjs`.

## Authority boundaries

This phase changes presentation and interaction-shell behavior only. It does not change:

- territory catalog data;
- primary-territory persistence semantics;
- activation approval or cohort assignment;
- residence assurance decisions;
- identity assurance;
- reputation or ranking;
- voter-roll freezing or governance eligibility;
- payments, donations or crowdfunding authorization.

## Next tranche

After this phase, the remaining legacy secondary domain surfaces are public city nodes, report detail, community detail/moderation, workflows and crowdfunding. Those surfaces should be migrated in domain-sized tranches so status semantics and authority boundaries can be reviewed explicitly rather than through blind visual replacement.

## Release certification

This phase is certified only when the exact PR head passes the applicable repository gates, including Mobile Core Parity, native typecheck, Android/iOS export assertions, Mobile Domain Parity, Golden API/Browser journeys, security scans and repository CI. Passing source and export checks does not constitute App Store or Play Store publication or physical-device validation.

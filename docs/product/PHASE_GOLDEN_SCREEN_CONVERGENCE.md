# Phase — Golden Screen visual convergence

## Objective

Move the native VÉRTICE primary surfaces from legacy local styling to the canonical product language shared with Web, without changing civic-domain authority, CTG One identity semantics, or server-side authorization boundaries.

## Runtime scope completed in this phase

- Dashboard / Inicio now consumes only canonical theme tokens and canonical VÉRTICE brand assets.
- Community now uses the shared palette, semantic feedback surfaces, typography roles and brand symbol.
- Acciones now uses canonical surfaces, form controls, status treatments and touch targets.
- Territorio / Reportes now uses canonical surfaces, semantic evidence states, form controls and brand symbol.
- Gobernanza now maps positive, warning and blocked eligibility states to canonical semantic tokens.
- Perfil now uses canonical identity, territory, notification and privacy treatments and is scroll-safe on smaller screens.
- The primary tab shell now consumes canonical spacing, radii, typography and semantic active-state colors.

## Canonical visual rules enforced

Primary mobile surfaces must not declare local hex colors. They must consume `apps/mobile/theme/vertice.ts`, which adapts `packages/design-tokens/src/index.ts`.

The canonical hierarchy is:

1. Brand identity: navy `#0A2A66`, citizen yellow `#F5B700`, critical red `#D72638`.
2. Neutral surfaces: background, surface, surfaceAlt, border and inputBorder tokens.
3. Semantic feedback: info, success, warning and error surfaces from the shared token package.
4. Typography target: Montserrat for display, Inter for body, DM Mono for technical/readout content.
5. Iconography target: Lucide, outline, 24px grid, 2px stroke.
6. Brand imagery: repository-controlled VÉRTICE wordmark, symbol and logo. Do not recreate the wordmark as generic text.

## CI contract

`apps/mobile/scripts/verify-product-parity.mjs` now treats the six primary tab surfaces as governed product surfaces. It fails when:

- a primary surface reintroduces legacy green/beige tokens;
- a migrated primary surface declares a local six-digit hex color;
- a migrated primary surface stops consuming the canonical native theme;
- a migrated primary surface stops using the canonical VÉRTICE brand component.

This converts visual coherence from a design preference into a repository contract.

## Explicitly not certified yet

### Native font binaries

The canonical typography families are defined, but the native app still uses platform-safe fallbacks until Montserrat, Inter and DM Mono are bundled through the release dependency pipeline. Do not claim exact typography parity before those font assets are installed and exercised in Android/iOS builds.

### Lucide runtime package

Lucide is the canonical iconography contract, but this phase intentionally does not introduce a new native package without a lockfile-certified dependency update. Navigation remains text-first rather than introducing a second icon family. The next dependency-certified subphase should add `lucide-react-native` together with its required native SVG runtime through the normal frozen-lockfile workflow.

## Release condition

This phase is code-complete only when the exact PR head passes Mobile Core Parity, native typecheck/export, SAST and the relevant golden journeys. It is not a production release merely because the code exists on the branch.

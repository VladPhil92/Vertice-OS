# Phase — Native Brand Runtime Certification

## Objective

Close the remaining gap between the VÉRTICE visual contract and the native Android/iOS runtime. This phase makes the canonical typography and iconography physically executable in the mobile bundle instead of leaving them as design targets backed by platform fallbacks.

## Runtime delivered

### Typography

The mobile app now bundles the same canonical family contract used by Web:

- Montserrat — display and headings.
- Inter — body, controls and product copy.
- DM Mono — technical/readout content.

`apps/mobile/theme/fonts.ts` owns the native font assets and exact weight aliases. `apps/mobile/app/_layout.tsx` loads them with `expo-font` before rendering the product shell. `apps/mobile/theme/vertice.ts` maps the canonical typography roles to those concrete bundled aliases.

The runtime no longer depends on Avenir, System, `sans-serif` or platform font synthesis as the normal brand path.

### Iconography

`lucide-react-native` plus `react-native-svg` provide the canonical icon runtime. `apps/mobile/components/VerticeIcon.tsx` is the product boundary: screens request semantic VÉRTICE icon names and the adapter owns Lucide, stroke width and sizing.

The primary tab navigation now uses the same icon grammar as Web:

- Inicio → Home.
- Comunidad → Users.
- Acciones → CheckCircle.
- Territorio → MapPin.
- Gobernanza → Landmark.
- Perfil → User.

Authentication surfaces also use the canonical chevron instead of text glyphs.

## Dependency contract

The native runtime is lockfile-backed and includes:

- `expo-font`
- `@expo-google-fonts/montserrat`
- `@expo-google-fonts/inter`
- `@expo-google-fonts/dm-mono`
- `lucide-react-native`
- `react-native-svg`

Dependency versions are committed to `apps/mobile/package.json` and `pnpm-lock.yaml`. No runtime dependency may be injected during production build outside the frozen lockfile.

## Coherence gates

`apps/mobile/scripts/verify-product-parity.mjs` now fails if:

- any required native brand runtime dependency disappears;
- the root application stops loading the bundled font registry;
- the theme stops resolving Montserrat, Inter or DM Mono through native aliases;
- the native icon adapter stops using Lucide or the canonical stroke contract;
- primary tab destinations lose their semantic icons;
- Login, Registro or any Golden Screen reintroduces local hex colors instead of canonical tokens;
- CTG One federation invariants regress.

## Security and product boundaries

This phase changes presentation/runtime dependencies only. It does not change `citizen_id`, CTG One federation, token issuance, civic identity assurance, territory authority, governance eligibility, reputation calculation or financial authorization.

Font loading errors are observable through the `[brand-runtime]` log prefix. The app remains recoverable if a font runtime error occurs; identity and civic functions are not coupled to successful typography rendering.

## Release certification

Code presence is not release evidence. This phase is considered certified only when the exact PR head passes, at minimum:

1. frozen-lockfile installation;
2. Mobile Core Parity;
3. native TypeScript typecheck;
4. Android export;
5. iOS export;
6. exported-artifact assertions;
7. relevant SAST/dependency checks;
8. Golden E2E journeys affected by Login and the primary shell.

Until those checks complete successfully, status is `NOT DEPLOYED` even though the implementation exists on the feature branch.

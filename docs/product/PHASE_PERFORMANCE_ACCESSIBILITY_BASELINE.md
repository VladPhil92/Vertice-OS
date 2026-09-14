# Phase — Reproducible Performance & Accessibility Baseline

Evidence sync: **2026-09-13**.

## Objective

Establish a reproducible, exact-head baseline for Web and Mobile artifact size plus deterministic accessibility debt before introducing release budgets. This phase deliberately avoids invented thresholds: only measurements proven repeatable under the controlled CI boundary become enforced ceilings, and future growth requires an explicit reviewed baseline update.

This is a regression-control phase. It is not a claim of physical-device performance, production Core Web Vitals, WCAG conformance, assistive-technology certification or store/market approval.

## Performance measurement contract

`scripts/measure-performance-baseline.mjs` measures raw build/export bytes after the same production-like compilation boundaries already used by release workflows:

- Web `.next/static`, excluding source maps;
- Web public assets;
- Expo Android export;
- Expo iOS export.

For each surface it records total files/bytes, runtime code, CSS, fonts, images and largest artifact. The controlled regression gate enforces only the subset that proved reproducible across repeated builds.

The first repeated export exposed a one-byte variance in Hermes bytecode without any change to mobile application source: Android moved by +1 byte while iOS moved by -1 byte, and the non-runtime asset bytes remained identical. Treating raw Hermes byte length as a hard ceiling would therefore create a false deterministic contract. The enforced baseline consequently:

- budgets Web build/static bytes directly;
- budgets Android and iOS **non-runtime asset bytes** exactly;
- records raw Hermes runtime-code bytes as diagnostic observations only.

A deterministic runtime-code metric may be promoted into the enforced set only after a repeatability study establishes a stable measurement boundary. This is not a tolerance band: unstable measurements are excluded rather than given an arbitrary percentage allowance.

The gate also intentionally does **not** budget wall-clock build duration, local navigation time, device startup, memory, CPU or network latency. Those signals require a stable benchmark/device environment and a variance study before a numeric threshold can be defensible.

## Accessibility measurement contract

`apps/web/scripts/measure-accessibility-baseline.mjs` opens four public routes against the compiled production Web artifact:

- `/`;
- `/auth/login`;
- `/auth/register`;
- `/account-deletion`.

The deterministic browser heuristic records:

- images without `alt`;
- buttons, links and `role="button"` elements without an accessible-name signal;
- form controls without a programmatic label;
- duplicate DOM ids;
- missing document language;
- missing main landmark.

The baseline ratchets both total issues and per-route/per-rule counts. Existing debt may decrease without a baseline update; any increase fails. A new issue category defaults to a ceiling of zero.

This heuristic is intentionally narrower than WCAG. Manual keyboard testing, screen-reader/VoiceOver/TalkBack testing, contrast review, zoom/reflow, touch-target validation and physical-device assistive-technology behavior remain separate evidence domains.

## Controlled baseline

`release/baselines/performance-accessibility.json` has two lifecycle states:

1. `bootstrap` — measurement infrastructure is being proven and no ceiling is claimed yet;
2. `enforced` — reproducible exact-head values are frozen as ceilings.

The bootstrap state is temporary. Completion requires CI evidence, an enforced baseline derived from reproducible signals, and a final exact-head run that passes that ratchet.

## Regression policy

The enforced policy is a **ratchet**, not an arbitrary allowance:

- reproducible artifact byte count below or equal to the baseline: pass;
- reproducible artifact byte count above the baseline: fail until a reviewed baseline update explains the intentional growth;
- accessibility issue count below or equal to the baseline: pass;
- any route/rule accessibility increase: fail until fixed or explicitly reviewed;
- unstable measurements remain informational until reproducibility is demonstrated.

This makes growth visible without pretending that an unmeasured percentage such as 5% or 10% is inherently safe.

## CI workflow

`.github/workflows/performance-accessibility-baseline.yml`:

1. checks out the exact submitted SHA;
2. installs the locked dependency graph;
3. builds Web in production mode;
4. starts the compiled Web artifact;
5. exports production-like Android/iOS bundles using non-secret release-contract placeholders;
6. measures artifact bytes and classifies runtime code;
7. measures deterministic public-route accessibility signals;
8. enforces the controlled reproducible baseline;
9. uploads the exact-head JSON reports and Web log as 14-day CI evidence.

## Authority and certification boundaries

Passing this gate means only that reproducible build/export signals did not grow past their controlled ceilings and deterministic accessibility debt did not increase.

It does not prove:

- signed Android/iOS device performance;
- real EAS linkage/signing;
- production CDN/cache/network behavior;
- Core Web Vitals from real users;
- WCAG AA/AAA compliance;
- screen-reader correctness;
- payment/provider performance;
- legal approval;
- App Store or Google Play approval;
- `CERTIFIED FOR MARKET RELEASE` status.

## Exit criteria

The phase is complete when:

- the workflow produces performance and accessibility reports for the exact PR head;
- the bootstrap baseline is replaced by an `enforced` baseline derived only from reproducible signals;
- the final exact-head run passes the enforced ratchet;
- existing required CI/security/governance checks are green;
- review findings are resolved;
- protected `main` remains current before squash/rebase merge.

## Next logical phase

After the baseline is frozen, the next repository-automatable tranche is **Accessibility Remediation & Runtime Budget Expansion**: remove the known public-route accessibility debt, add keyboard/focus and authenticated golden-route accessibility coverage, and establish a deterministic runtime-code measurement before promoting runtime bundle budgets into enforcement.

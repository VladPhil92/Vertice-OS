# Phase — Accessibility Remediation & Runtime Budget Expansion

Evidence sync: **2026-09-13**.

## Objective

Turn the first reproducible performance/accessibility baseline into an active quality ratchet: remove the known deterministic accessibility debt on public authentication surfaces, add keyboard/focus behavior to Golden Browser Journeys, expand the browser heuristic, and establish a controlled lifecycle for per-route encoded resource budgets.

This phase is repository-level release hardening. It does not claim WCAG certification, assistive-technology certification, physical-device performance or market-release certification.

## Public accessibility remediation

The previous exact-head baseline exposed two deterministic issues: both `/auth/login` and `/auth/register` lacked a main landmark. This phase removes that debt and freezes the controlled public-route issue ceiling at zero.

The authentication surfaces now include:

- exactly one semantic `main` landmark;
- programmatic labels for form controls;
- visible `focus-visible` treatment on critical interactive controls;
- keyboard-reachable password visibility toggles with `aria-pressed` state;
- minimum practical touch/focus target expansion for password toggles;
- `aria-live` alert behavior for form errors;
- explicit help association for the registration identity field through `aria-describedby`;
- decorative icons excluded from the accessibility tree where appropriate.

Authentication, CTG One federation, API endpoints and redirect authority are unchanged.

## Golden keyboard contract

`apps/web/e2e/accessibility-auth.spec.ts` adds deterministic keyboard coverage for Login and Registration. The suite tabs through critical controls and asserts that focus reaches the expected element with a visible outline or focus shadow. It also proves keyboard activation/state for the password visibility control and the registration help association.

The test is part of `e2e:golden`, so the existing Golden Browser Journeys workflow protects it on future changes.

This is stronger than static markup inspection but remains narrower than full manual keyboard or assistive-technology certification.

## Expanded browser accessibility heuristic

`apps/web/scripts/measure-accessibility-baseline.mjs` advances its report schema to `1.1` and now checks:

- image `alt` presence;
- accessible-name signals for buttons, links and button roles;
- keyboard tabbability for non-native button roles;
- programmatic labels for form controls;
- duplicate IDs;
- document language;
- exactly one main landmark;
- exactly one level-one heading.

It also records the number of focusable elements per controlled route.

The controlled public-route accessibility ceiling is now zero. Any new deterministic issue or new issue code therefore fails without requiring a baseline update.

## Runtime resource budget lifecycle

The browser measurement already records route-level resource transfer signals independent of wall-clock navigation timing:

- total encoded resource bytes;
- encoded JavaScript bytes;
- encoded CSS bytes.

This phase introduces `runtime_resource_budget` inside `release/baselines/performance-accessibility.json` with its own lifecycle:

1. `bootstrap` — exact-head route resource bytes are captured but not yet enforced;
2. `enforced` — the reviewed exact-head values become route ceilings.

The verifier requires the route set to remain exact and enforces each encoded byte category independently once the budget is frozen.

No percentage tolerance is introduced. Lower values pass. Higher values require an explicit reviewed baseline update explaining intentional growth.

## Timing boundary

Navigation duration, DOMContentLoaded and load-event timings remain diagnostic only. Shared GitHub runners are not a defensible environment for a hard latency/SLO budget without a variance study. This phase therefore does not turn volatile wall-clock observations into false performance guarantees.

Likewise, raw Hermes bytecode length remains diagnostic because repeated unchanged exports already demonstrated byte-level variance. Mobile non-runtime assets remain the reproducible enforced signal until a deterministic runtime-code measurement is established.

## Certification boundary

A pass proves only that:

- the controlled public-route heuristic has no known deterministic issues;
- Golden Browser keyboard/focus contracts still pass;
- reproducible build/export size signals remain within controlled ceilings;
- once frozen, controlled public-route encoded resource bytes do not regress.

It does **not** prove:

- WCAG AA/AAA compliance;
- VoiceOver, TalkBack or other screen-reader correctness;
- zoom/reflow/contrast/manual keyboard certification across the full product;
- signed Android/iOS performance;
- Core Web Vitals from real users;
- real network/CDN performance;
- App Store or Google Play acceptance;
- `CERTIFIED FOR MARKET RELEASE`.

## Exit criteria

The phase is complete when:

- Login and Registration produce zero deterministic accessibility issues;
- the Golden keyboard/focus contract passes on the exact final PR head;
- the expanded accessibility heuristic passes with a zero issue ceiling;
- exact-head route encoded resource values are captured and frozen into `runtime_resource_budget.mode=enforced`;
- the final Performance & Accessibility Baseline workflow passes in fully enforced mode;
- required CI/security/governance checks are green;
- review findings are resolved;
- protected `main` remains current before squash/rebase merge.

## Next logical phase

After these public-route budgets are frozen, the next repository-automatable tranche is **Authenticated Accessibility Coverage & Release UX Hardening**: extend deterministic accessibility and keyboard contracts into authenticated golden routes, audit focus order/modal semantics/notifications, and retire any remaining measurable legacy UX debt before physical-device and external-provider certification becomes the dominant blocker.

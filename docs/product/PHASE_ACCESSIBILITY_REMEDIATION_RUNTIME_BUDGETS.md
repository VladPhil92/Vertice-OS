# Phase — Accessibility Remediation & Runtime Budget Expansion

Evidence sync: **2026-09-13**.

## Objective

Turn the first reproducible performance/accessibility baseline into an active quality ratchet: remove the known deterministic accessibility debt on public authentication surfaces, add keyboard/focus behavior to Golden Browser Journeys, expand the browser heuristic, and establish controlled per-route decoded resource budgets.

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

`apps/web/scripts/measure-accessibility-baseline.mjs` advances its report schema to `1.2` and now checks:

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

## Runtime resource budgets

The browser measurement records route-level resource signals independent of wall-clock navigation timing:

- total decoded resource body bytes;
- decoded JavaScript body bytes;
- decoded CSS body bytes.

Encoded transfer bytes continue to be captured as diagnostics, but are not used as hard ceilings because repeated same-source requests showed transport-level byte variance.

`runtime_resource_budget` inside `release/baselines/performance-accessibility.json` uses a bootstrap → enforced lifecycle. The exact-head capture at `dce58da27c6c74f5eb285af7e23f51f9061f8b7b` produced the reviewed deterministic ceilings now enforced:

| Route | Total decoded | JS decoded | CSS decoded |
| --- | ---: | ---: | ---: |
| `/` | 1,186,964 B | 886,961 B | 113,865 B |
| `/auth/login` | 1,291,631 B | 900,603 B | 113,865 B |
| `/auth/register` | 1,253,644 B | 886,961 B | 113,865 B |
| `/account-deletion` | 1,147,542 B | 872,396 B | 113,865 B |

The verifier requires the route set to remain exact and enforces each decoded byte category independently. No percentage tolerance is introduced. Lower values pass. Higher values require an explicit reviewed baseline update explaining intentional growth.

## Reviewed build cost of remediation

The accessibility changes intentionally increased the reproducible Web artifact relative to the previous baseline:

- `.next/static`: 5,067,542 B → **5,068,563 B** (+1,021 B);
- Web runtime code: 4,399,390 B → **4,400,215 B** (+825 B);
- CSS: 154,544 B → **154,740 B** (+196 B);
- largest Web artifact: unchanged at **1,766,533 B**;
- public assets: unchanged at **1,469,154 B**;
- Android non-runtime assets: unchanged at **5,553,986 B**;
- iOS non-runtime assets: unchanged at **4,590,336 B**.

This growth is not hidden behind a tolerance. It is explicitly reviewed as the measured cost of semantic landmarks, focus treatment and accessibility-state wiring, and the new values become the controlled ceiling.

Raw Hermes bytecode length remains diagnostic because repeated unchanged exports already demonstrated byte-level variance. Mobile non-runtime assets remain the reproducible enforced signal until a deterministic runtime-code measurement is established.

## Timing boundary

Navigation duration, DOMContentLoaded and load-event timings remain diagnostic only. Shared GitHub runners are not a defensible environment for a hard latency/SLO budget without a variance study. Encoded transfer bytes are likewise diagnostic because transport compression introduced same-source byte variance. This phase therefore does not turn volatile transport or wall-clock observations into false performance guarantees.

## Certification boundary

A pass proves only that:

- the controlled public-route heuristic has no known deterministic issues;
- Golden Browser keyboard/focus contracts still pass;
- reproducible build/export size signals remain within controlled ceilings;
- controlled public-route decoded resource body bytes do not regress.

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
- exact-capture route decoded resource values are frozen into `runtime_resource_budget.mode=enforced`;
- the final Performance & Accessibility Baseline workflow passes in fully enforced mode;
- required CI/security/governance checks are green;
- review findings are resolved;
- protected `main` remains current before squash/rebase merge.

## Next logical phase

After these public-route budgets are frozen, the next repository-automatable tranche is **Authenticated Accessibility Coverage & Release UX Hardening**: extend deterministic accessibility and keyboard contracts into authenticated golden routes, audit focus order/modal semantics/notifications, and retire any remaining measurable legacy UX debt before physical-device and external-provider certification becomes the dominant blocker.

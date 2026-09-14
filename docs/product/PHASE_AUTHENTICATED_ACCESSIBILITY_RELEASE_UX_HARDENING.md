# Phase — Authenticated Accessibility Coverage & Release UX Hardening

Evidence sync: **2026-09-14**.

## Objective

Extend the deterministic accessibility and keyboard regression contract from public authentication routes into the authenticated Web shell, beginning with shared notification surfaces and release-critical interaction state.

This phase hardens keyboard behavior, focus restoration, state exposure and assistive-technology announcements without changing authentication authority, authorization rules, API contracts, CTG One federation or backend business logic.

It is repository-level release hardening. It does **not** claim WCAG certification, screen-reader certification, physical-device certification or market-release certification.

## Authenticated notification shell

`apps/web/components/ui/NotificationBell.tsx` is promoted from a visually functional popover into an explicit keyboard and accessibility contract:

- the trigger exposes `aria-expanded`, `aria-controls` and `aria-haspopup="dialog"`;
- unread state is included in the trigger's accessible name;
- the open surface exposes dialog semantics and an accessible title;
- opening the surface moves focus to an explicit close control;
- `Escape` closes the surface and restores focus to the notification trigger;
- explicit close also restores trigger focus;
- per-notification actions expose meaningful accessible names instead of relying on `title` or color alone;
- critical controls receive visible `focus-visible` treatment;
- decorative icons and badges are excluded from the accessibility tree where appropriate.

The notification polling cadence, read endpoints and navigation destinations are unchanged.

## Live operational announcements

`apps/web/components/ui/LiveToast.tsx` now exposes realtime dashboard updates through a polite live region:

- new messages are announced with `aria-live="polite"`;
- additions/text changes are the relevant live-region events;
- each message is atomic for announcement purposes;
- close controls include the announcement content in their accessible name;
- decorative realtime icons are excluded from the accessibility tree;
- keyboard-visible focus is enforced on dismissal controls.

The existing five-second auto-dismiss behavior remains unchanged.

## Operational notification inbox

`/dashboard/notifications` now exposes its interaction state programmatically:

- initial loading is a named live status rather than an unlabeled spinner;
- notification filters form a labeled control group;
- each filter exposes selection using `aria-pressed` and points to the controlled result region;
- result refresh state is exposed using `aria-busy` and a polite status region;
- unread count changes are announced politely;
- load and mutation failures are surfaced through `role="alert"`;
- `mark one` and `mark all` failures no longer disappear as unhandled UI-side promise failures;
- interactive controls use keyboard-visible focus treatment;
- decorative visual state markers do not pollute the accessibility tree.

No notification categorization, financial/civic separation, persistence or API authority is changed.

## Authenticated Golden Browser contract

`apps/web/e2e/authenticated-accessibility.spec.ts` adds deterministic authenticated coverage and is included in `e2e:golden`.

The first tranche freezes two journeys:

### GJ-B07 — Notification state, keyboard escape and focus restoration

The journey proves that:

- the authenticated notification inbox renders inside the single dashboard `main` landmark;
- the inbox retains a level-one heading;
- filter selection is reflected through `aria-pressed`;
- the notification trigger reflects closed/open state through `aria-expanded`;
- opening the notification dialog establishes a deterministic focus target;
- `Escape` closes the dialog;
- focus returns to the original trigger after keyboard dismissal.

### GJ-B08 — Mutation failure visibility

The journey forces a notification-read mutation to fail and proves that the authenticated UI surfaces the failure through an alert instead of silently swallowing it. The assertion is scoped to the operational notification result region so the contract remains independent from Next.js' own route-announcer live region.

All backend responses used by these browser contracts are deterministic test fixtures; the tests do not weaken or bypass production authorization logic.

## Release invariants

This phase preserves the following boundaries:

- authenticated route authorization remains server/middleware controlled;
- CTG One federation and token authority are unchanged;
- notification read/write authority remains in the existing API endpoints;
- no civic, governance, financial or administrative capability is granted by accessibility state;
- no percentage tolerance is introduced into performance budgets;
- public-route accessibility debt remains controlled by the existing zero-debt baseline;
- wall-clock timing and transport-compressed byte observations remain diagnostic only where reproducibility has not been proven.

## Reviewed reproducible Web cost

The exact-head capture at `29ab07707193124708a6e18100cdd74036623fee` measured the production cost of the authenticated notification accessibility hardening. The later GJ-B08 locator correction changes only Playwright test code and does not alter the production artifact.

The reviewed reproducible deltas are:

- `.next/static`: **5,068,563 B → 5,071,035 B** (**+2,472 B**);
- Web runtime code: **4,400,215 B → 4,402,687 B** (**+2,472 B**);
- Web CSS: unchanged at **154,740 B**;
- largest Web artifact: unchanged at **1,766,533 B**;
- public assets: unchanged at **1,469,154 B**;
- Android non-runtime assets: unchanged at **5,553,986 B**;
- iOS non-runtime assets: unchanged at **4,590,336 B**.

The increase is frozen as an exact reviewed ceiling rather than hidden behind a percentage allowance. Public-route deterministic accessibility debt remains **0**, and the decoded per-route runtime budgets remain unchanged because the controlled public routes did not regress.

Raw Hermes bytecode and transport-compressed route bytes remain diagnostic-only signals where byte-level variance has already been demonstrated.

## Performance and bundle boundary

The additional ARIA state and focus-management logic changes reproducible Web artifact bytes. The exact increase above is captured by the existing **Performance & Accessibility Baseline** workflow and frozen explicitly in `release/baselines/performance-accessibility.json`.

No percentage buffer or arbitrary tolerance widening is permitted. Future reproducible growth still requires a new exact-head measurement and explicit baseline review.

## Exit criteria

This phase is complete when:

- notification popover keyboard state and focus restoration are protected by Golden Browser Journeys;
- notification inbox filter state and mutation-error exposure are protected by Golden Browser Journeys;
- realtime dashboard toasts expose a polite live region;
- authenticated notification controls have visible keyboard focus treatment;
- `e2e:golden` includes the authenticated accessibility contract;
- the reviewed exact-byte Web growth is frozen without widening unrelated ceilings;
- Performance & Accessibility Baseline passes on the final PR head;
- CI, SAST, Golden Governance, Federation, Dashboard Browser and Golden E2E gates are green;
- review findings are resolved;
- protected `main` is current before merge.

## Next logical phase

After the shared authenticated shell is protected, the next repository-automatable tranche is **Authenticated Forms, Overlays & Complex Interaction Accessibility Expansion**: audit dialogs, destructive confirmations, async forms, validation summaries, combobox/select behavior, focus traps and route-transition focus across governance, reports, crowdfunding and administrative workflows. Physical-device and assistive-technology certification remains a separate evidence layer after deterministic repository coverage is exhausted.

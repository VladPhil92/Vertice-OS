# Phase — Critical Secondary Surface Convergence

## Objective

Extend the canonical VÉRTICE mobile product language beyond the primary Golden Screens into the secondary surfaces with the highest trust and operational impact. This tranche covers Notifications, Civic Identity Assurance and Account Deletion.

These routes previously remained on the legacy beige/green visual layer even after Login, Dashboard and the primary tabs had converged on the canonical blue/yellow/red system. That split made the native product appear to change identity when a citizen moved from a primary screen into privacy, identity or notification workflows.

## Runtime delivered

### Notifications

`apps/mobile/app/notifications.tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter families, VÉRTICE brand asset boundary and semantic Lucide icons. Unread state uses the information/citizen token system instead of the retired green palette, while error and empty states use the canonical semantic feedback colors.

### Civic Identity Assurance

`apps/mobile/app/identity/index.tsx` now presents proofing and assurance through the same typography, spacing, cards and semantic status language used by the rest of VÉRTICE. Verification requirements use semantic Lucide marks rather than Unicode check/circle glyphs. Success and pending assurance states remain visually distinct without changing backend eligibility semantics.

### Account Deletion

`apps/mobile/app/account-deletion.tsx` now uses canonical privacy/destructive semantics, VÉRTICE typography and Lucide navigation/delete icons. The legal and functional deletion flow is unchanged: visual convergence must not weaken the confirmation boundary or alter retention rules.

## Icon boundary extension

`apps/mobile/components/VerticeIcon.tsx` now exposes additional semantic names required by trusted secondary workflows:

- `back`
- `notifications`
- `verified`
- `checkCircle`
- `circle`
- `delete`

Product screens still do not select arbitrary icon libraries directly; Lucide ownership remains centralized in the adapter.

## Regression gate

`apps/mobile/scripts/verify-critical-secondary-surfaces.mjs` certifies the three migrated surfaces. It fails if a surface:

- loses the canonical theme adapter;
- loses the VÉRTICE brand or icon boundary;
- reintroduces a local six-digit hex color;
- restores Unicode arrow/check/circle glyphs as UI icons;
- declares a raw font-family string;
- stops using the semantic back icon.

The gate is chained into the existing Mobile Core Parity path through `verify-font-alias-contract.mjs`.

## Boundaries

This phase is presentation and interaction-shell work only. It does not change notification delivery, identity proofing decisions, governance eligibility, user deletion semantics, retention policy, CTG One federation, token issuance, reputation or financial authorization.

The remaining secondary surfaces — territory activation/assurance, public city nodes, report detail, community detail/moderation, workflows and crowdfunding — are intentionally left for the next convergence tranche so each domain can be migrated with its own semantic status review instead of a blind color replacement.

## Release certification

This phase is certified only when the exact PR head passes the relevant repository gates, including:

1. Mobile Core Parity;
2. native TypeScript typecheck;
3. Android and iOS export assertions;
4. Account Deletion Privacy;
5. identity/domain parity gates affected by the migrated screen;
6. SAST/dependency checks;
7. Golden E2E and repository CI where applicable.

Passing source checks does not constitute App Store or Play Store publication, and no physical-device behavior is claimed without device evidence.

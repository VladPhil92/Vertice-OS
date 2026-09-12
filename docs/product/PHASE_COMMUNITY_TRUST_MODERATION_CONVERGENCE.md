# Phase — Community Trust & Moderation Convergence

## Objective

Converge the remaining community trust surfaces — public civic profile, civic leaderboard and community safety reporting — on the canonical VÉRTICE native product language while preserving the distinction between social interaction, reputation, political authority and moderation.

This tranche follows Public City & Report Domain Convergence. The community feed already used the canonical runtime, but entering a public profile, opening the civic ranking or reporting content still crossed into the retired beige/green layer and could visually blur the meaning of follows, scores and moderation actions.

## Runtime delivered

### Public civic profile

`apps/mobile/app/community/[citizenId].tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter aliases, VÉRTICE brand assets and semantic Lucide icons.

Follow, unfollow, block, unblock and report actions now share the same interaction contract as the rest of the native product. Profile metrics are separated from safety controls, and recent civic activity exposes verification state without promoting community interaction into institutional authority.

The underlying endpoints are unchanged. Following remains a social subscription only; it is not an endorsement, vote, transfer of reputation or source of governance authority. Blocking limits the citizen experience but does not alter the target's civic identity or score.

### Civic leaderboard

`apps/mobile/app/community/leaderboard.tsx` now presents rank, leader score, verified actions and public activity through canonical cards, typography and semantic icons.

The ranking boundary is explicit in-product: follower count, likes, impressions and community corroborations are not presented as political legitimacy. The existing leaderboard endpoint and scoring authority remain unchanged.

### Community moderation report

`apps/mobile/app/community/report.tsx` now presents safety reasons as accessible radio controls, uses canonical semantic status cards, and distinguishes report submission from moderation outcome.

Submitting a report still calls the existing `/community/safety/reports` contract. A report opens a moderation case; it does not automatically sanction the target, modify reputation, determine identity or remove civic authority. The backend moderation workflow remains the source of truth for case disposition.

## Icon boundary extension

`apps/mobile/components/VerticeIcon.tsx` now exposes semantic names for this domain tranche:

- `userPlus`
- `userMinus`
- `block`
- `unblock`
- `flag`
- `shield`
- `moderation`
- `leaderboard`

Lucide ownership remains centralized in the adapter; product screens do not import icon families directly.

## Regression gate

`apps/mobile/scripts/verify-community-trust-surfaces.mjs` certifies all three community trust surfaces. It fails if a migrated screen:

- loses the canonical native theme adapter;
- loses VÉRTICE brand or semantic icon boundaries;
- imports Lucide directly;
- reintroduces local hexadecimal colors;
- restores Unicode glyphs as interface icons;
- introduces raw font-family strings;
- removes follow/block/report or leaderboard contracts;
- removes the explicit follow-is-not-endorsement boundary;
- removes the report-is-not-automatic-sanction boundary.

The gate is chained into Mobile Core Parity through `verify-font-alias-contract.mjs`.

## Authority and trust boundaries

This phase changes presentation, accessibility and interaction-shell behavior only. It does not change:

- community ranking formulas;
- reputation calculation;
- follow graph semantics;
- block semantics;
- moderation policy or case disposition;
- identity or residence assurance;
- governance eligibility or voter rolls;
- payments, donations or crowdfunding authorization.

The product rule is explicit: reputation is not authority, following is not political endorsement, and reporting is not an automatic sanction.

## Next tranche

After this phase, the next legacy domain surface is workflow and case-management experience. That tranche should converge workflow lists, case detail, status history and citizen action requirements without allowing the client to invent legal/administrative state transitions. Crowdfunding and other financial surfaces remain separate because they require payment, authorization and financial-risk review.

## Release certification

This phase is certified only when the exact PR head passes the applicable repository gates, including Mobile Core Parity, native typecheck, Android/iOS export assertions, Mobile Domain Parity, Golden API/Browser journeys, security scans and repository CI. Passing source and export checks does not constitute App Store or Play Store publication or physical-device validation.

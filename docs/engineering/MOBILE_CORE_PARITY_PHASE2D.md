# Phase 2D-1 — Native Community/Feed Parity

## Purpose

Phase 2 shipped the mobile foundation (auth, command center, civic actions, territorial reports/map, governance, push devices). Its own "Next construction order — Phase 2D" named community/feed + social graph surfaces as item 1, ahead of workflows, Identity Assurance and crowdfunding tracking. Phase 2D-1 delivers exactly that slice: nothing else.

## Scope

- `apps/mobile/app/(tabs)/community.tsx` — public "Descubrir" feed (`GET /community/feed`) and authenticated "Siguiendo" feed (`GET /community/following/feed`), both consuming the existing civic-action-v1 scoring contract as-is.
- `apps/mobile/app/community/[citizenId].tsx` — public civic profile, follow/unfollow (`GET/POST/DELETE /community/profiles/:citizenId*`), recent verified actions.
- `apps/mobile/app/community/leaderboard.tsx` — civic leaderboard (`GET /community/leaderboard`).

No new API endpoints, schema, or scoring logic were added. This phase is a pure native consumer of the community module that already ships in `apps/api/src/modules/community`.

## Explicitly out of scope for 2D-1

- Civic avatar upload/confirm (needs the same Cloudflare Images production canary already flagged as external debt in Phase 2B/2C — not duplicated here);
- community activity validation (corroborate/dispute) UI — the read-only validation summary is shown, submitting a stance is deferred to a later slice;
- workflows/civic cases, Identity Assurance, crowdfunding tracking — items 2-4 of the Phase 2D construction order, each a separate phase.

## Invariants

- Following/unfollowing and viewing a civic profile never grants identity assurance, reputation, authority, or governance eligibility — the profile screen states this explicitly.
- The scoring note ("seguidores, likes e impresiones no suman reputación") from the API contract is surfaced verbatim in both the feed and the leaderboard, not paraphrased into something stronger.
- No mobile-side score computation, ranking, or caching of scoring logic — the client renders exactly what the API returns.
- All requests reuse the existing `apiFetch`/`apiMutation` client (bearer auth, automatic refresh, idempotency keys for mutations); no parallel auth or request path was introduced.

## Release states

- **IMPLEMENTED**: this branch — screens, types and navigation are present and typecheck.
- **INTEGRATED**: merged to `main` with the existing "Mobile Core Parity" gate (typecheck + Android/iOS Expo export) green.
- **DEPLOYED**: an EAS build containing this SHA is distributed to a test channel.
- **READY**: physical-device smoke confirms feed load, follow/unfollow, and profile navigation against a real API origin.
- **CERTIFIED**: not applicable — this phase touches no external provider or regulated flow.

## Rollback

Purely additive: a new tab and two new stack screens. Reverting removes the tab and screens; it does not touch `apps/api` or any migration.

## Next phase

Continue the Phase 2D construction order: item 2, workflows/civic cases and pending-action detail, on native.

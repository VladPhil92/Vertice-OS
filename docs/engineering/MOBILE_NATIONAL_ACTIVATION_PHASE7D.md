# Phase 7D — Mobile Territorial Activation & City Experience Parity

## Objective

Bring the Phase 7C national city-discovery and voluntary citizen-activation journeys to the Expo mobile client without introducing a parallel backend, new authority semantics, or new device-permission requirements.

Phase 7D is a parity and coherence phase. The canonical source of truth remains the Phase 7A–7C territorial API.

## Scope

### Mobile public city node

- Route: `app/city/[code].tsx`.
- Reads `GET /territories/public/:code?feed_limit=6` as a public endpoint.
- Displays the same aggregate city projection used by web:
  - activation status;
  - civic momentum;
  - active citizens;
  - civic actions;
  - verified actions;
  - proposals;
  - launch state;
  - active cohort count;
  - pending voluntary-interest count;
  - public territorial feed.
- Explicitly communicates that payments, donations, payouts, subscriptions, KYC/KYB, economic capacity and ideology are excluded from the civic momentum signal.

### Primary territory selection

- Route: `app/territory/select.tsx`.
- Searches the existing territorial catalog with `GET /territories`.
- Filters the mobile choice surface to municipality/district nodes.
- Persists through the canonical `PUT /territories/me` endpoint.
- Selection remains `self_asserted` product context. It is not territory assurance, verified residence or governance eligibility.

### Citizen activation journey

- Route: `app/territory/activate.tsx`.
- Reads `GET /territories/me` and `GET /territories/activation/me/interests`.
- Submits through `POST /territories/activation/:code/interests`.
- Withdraws through `DELETE /territories/activation/:code/interests/:role`.
- Uses the same roles as Phase 7C: `ambassador`, `organizer`, `observer`.
- Uses the same lifecycle: `pending`, `approved`, `declined`, `withdrawn`.
- Preserves the 500-character message limit.
- Reuses the mobile idempotency-key layer for submit/withdraw retries.

### Navigation coherence

Phase 7D connects the territorial journey from:

- citizen Home;
- Profile;
- public city node;
- territory selection;
- activation history.

The root Expo Router stack registers `city/[code]`, `territory/select`, and `territory/activate` explicitly.

## Authority and identity invariants

1. Selecting a territory does not create `territory_assurance`.
2. Selecting a territory does not prove residence.
3. Submitting an activation interest does not create a role grant.
4. Approval of an interest does not assign a launch cohort.
5. Cohort assignment remains a separate, auditable Phase 7B superadmin action.
6. Activation interest does not modify reputation, ranking, identity assurance, voter roll, voting weight, governance eligibility or organic reach.
7. The mobile client does not compute civic authority or launch readiness independently; it renders canonical API state.
8. Financial signals remain excluded from civic momentum and activation authority.

## Device-permission boundary

Phase 7D adds no GPS, camera, photo-library, notification or background permission request. Existing Phase 2B/2C device capabilities remain isolated to their existing workflows.

## Data and migration boundary

Phase 7D creates no database migration and no new financial, identity or governance table. It consumes the durable Phase 7C `territory_activation_interests` ledger and existing Phase 7A territory catalog.

## Automated release gate

`.github/workflows/mobile-national-activation.yml` must prove the exact submitted SHA with:

- `scripts/verify-mobile-national-activation.mjs`;
- Phase 7C source-contract verification;
- mobile TypeScript typecheck;
- Android Expo export;
- iOS Expo export.

The gate does not establish physical-device certification, App Store/Play distribution readiness, verified residence, staffed launch cohorts or national GA.

## Required manual runtime smoke before READY

On the same release candidate:

1. Sign in to a real non-admin citizen account.
2. Open Home and confirm territorial card state.
3. If no territory is linked, search and select a real municipality/district.
4. Confirm the selected territory is returned after app restart/session refresh.
5. Open the public city node and confirm aggregate metrics and feed render.
6. Submit one voluntary interest with a test message.
7. Confirm it appears in `pending` state on mobile and the existing admin queue.
8. Withdraw the interest and confirm it becomes `withdrawn`.
9. Confirm the citizen received no role grant, cohort assignment, reputation delta, governance eligibility change or territory assurance.
10. Repeat the primary journey on both Android and iOS signed preview builds.

## Release semantics

- Source present on branch: **IMPLEMENTED**.
- Exact-SHA CI and exports green: **CI VERIFIED / INTEGRATED**.
- Merge to `main`: **INTEGRATED**.
- Successful production deployment of the merge SHA: **DEPLOYED** for shared API/web runtime; mobile binary remains a separate release surface.
- Signed physical-device smoke on both platforms: eligible for **MOBILE READY** assessment.
- External distribution/provider acceptance: required before **CERTIFIED** claims.

## Rollback

All Phase 7D changes are additive mobile UI/types/docs/CI changes. Rollback can remove the new routes and navigation entries without deleting Phase 7C activation-interest data. Existing server-side territorial state remains authoritative and intact.

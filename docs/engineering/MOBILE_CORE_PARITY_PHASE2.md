# Mobile Core Parity — Phase 2

Execution date: 2026-09-08

## Objective

Move VÉRTICE OS from a native command-center prototype to a useful civic client without cloning domain logic into React Native.

Phase 2 is split deliberately:

- **2A — Civic Core Parity:** API-backed actions, evidence, territorial reporting and governance participation.
- **2B — Native Device & Territorial Evidence Core:** foreground GPS, proximity, camera/gallery evidence, server-confirmed media and deep-linkable report details.
- **2C — Device Release & Engagement Certification:** embedded map, remote push lifecycle, EAS preview/device evidence and physical-device release certification.

This split prevents provider credentials, APNs/FCM configuration or physical-device availability from being misrepresented as completed product work.

## Phase 2A delivery

### Actions

Native users can:

1. read their own civic actions from `/civic-actions/mine`;
2. create an action through the canonical verified API;
3. attach evidence by URL;
4. observe evidence count, civic score and confidence as separate signals.

No reputation formula exists in the app. Mobile only renders server state.

### Territory

Native users can:

1. read public reports;
2. create a verified georeferenced report;
3. set category, neighborhood, coordinates and address reference;
4. rely on backend idempotency for retry safety.

### Governance

Native users can:

1. discover public proposals;
2. endorse only in backend-supported phases;
3. vote with the canonical `-1 | 0 | 1` ledger contract while a proposal is in voting state;
4. read the canonical tally and `quorum_reached` state.

Eligibility, civic identity assurance, frozen electorate, delegation precedence and no-double-influence guarantees remain exclusively backend concerns.

## Native mutation contract

Critical mutations reuse `Idempotency-Key` while a same method/path/payload operation has an uncertain outcome. The mobile client does not locally fake successful actions, reports, endorsements or votes when the API fails.

Authentication continues through `/auth/mobile/*`, SecureStore and server-side session authority.

## Phase 2B delivery

### Foreground geolocation

The territorial client now uses `expo-location` only on explicit citizen action:

1. request foreground permission;
2. acquire a high-accuracy current position;
3. populate the report coordinates;
4. preserve manual coordinate editing;
5. query `/territorial/reports/nearby` within 3 km.

Phase 2B does not request background location. Coordinates are territorial context/evidence and do not create identity assurance, civic authority or voting eligibility.

### Native evidence capture

The client now uses `expo-image-picker` for image evidence:

1. request camera or media-library permission when the citizen chooses the corresponding action;
2. capture/select one image and preview its local URI;
3. request `/territorial/media/upload-intent`;
4. upload the image directly to the provider URL;
5. call `/territorial/media/confirm`;
6. submit only the confirmed `media_asset_id` with the canonical report mutation.

The local URI is never considered durable evidence. The server validates provider asset identity, citizen ownership, purpose metadata and delivery URL before the asset becomes attachable.

Microphone permission is disabled because this Phase 2B slice handles image evidence, not audio/video recording.

### Proximity and report detail

The native territorial experience now includes:

- current-position proximity view backed by `/territorial/reports/nearby`;
- distance display for nearby incidents;
- dynamic Expo Router route `report/[id]`;
- deep-link scheme `vertice://` inherited from the app configuration;
- canonical detail fetch through `/territorial/reports/:id`;
- evidence image rendering;
- lifecycle timestamps;
- external map handoff using the report's canonical coordinates.

This is a useful geo experience but not an embedded map SDK. An in-app map remains Phase 2C.

## Phase 2B privacy and security invariants

- Foreground location only; no background tracking.
- Location permission is requested in response to a citizen action.
- Camera/library permission is scoped to evidence capture.
- Location is not identity assurance.
- Local image URIs are not public evidence.
- Provider-backed evidence fails closed when storage is unavailable.
- The server remains authoritative for media ownership and report attachment.
- Phase 2B does not alter reputation formulas, governance authority or financial state.
- Code presence does not certify physical-device behavior or external providers.

## Phase 2B quality contract

`apps/mobile/scripts/verify-device-capabilities.mjs` asserts that:

- `expo-location` and `expo-image-picker` stay locked to the approved Expo SDK 57 line;
- foreground location permission copy remains configured;
- camera/photo permission copy remains configured;
- microphone permission remains disabled;
- background-location permission is absent;
- report deep-link routing remains registered;
- proximity and provider-confirmed media contracts remain referenced by the native client.

The `Mobile Core Parity` workflow additionally performs:

1. `pnpm install --frozen-lockfile`;
2. device-capability contract verification;
3. mobile TypeScript validation;
4. Expo public configuration resolution;
5. Android export;
6. iOS export;
7. exported artifact directory assertions.

Passing these gates means **IMPLEMENTED + exportable**, not physical-device or app-store certification.

## Phase 2C next order

1. introduce an embedded map surface only after choosing and documenting the map provider/runtime policy;
2. implement remote push token registration/lifecycle and APNs/FCM/Expo delivery without making delivery authority client-side;
3. deep-link notification actions into report/action/governance detail routes;
4. produce signed EAS preview artifacts with the real Expo project/credentials;
5. execute Android and iOS physical-device permission, GPS, camera, media upload and deep-link smoke tests;
6. execute a production Cloudflare Images canary;
7. only then move mobile device capabilities from `IMPLEMENTED` to `READY`/`CERTIFIED`.

## Definition of done — Phase 2B

- foreground GPS and proximity code present;
- camera/library image evidence code present;
- media provider intent/confirm flow preserved;
- report detail route/deep link present;
- dependency lock reproducible;
- structural device-capability contract green;
- TypeScript green;
- Android/iOS Expo exports green;
- monorepo CI and Golden journeys remain green;
- no unresolved P1/P2 review defect in the Phase 2B PR.

External provider credentials, physical-device tests and stores are explicitly excluded from 2B completion and remain release-certification dependencies.

# VÉRTICE OS Mobile

Native iOS/Android client for VÉRTICE OS, built with Expo SDK 57, React Native 0.86 and Expo Router.

## Runtime baseline

- Node.js >= 22.13
- pnpm 10
- Expo SDK 57
- React Native 0.86.3
- React 19.2.3

## Local setup

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm install --frozen-lockfile
pnpm mobile
```

`EXPO_PUBLIC_API_URL` must point to an API origin reachable by the device. Production and signed preview builds must use HTTPS.

Phase 2C also accepts build-time `EAS_PROJECT_ID` and `GOOGLE_MAPS_API_KEY`. They are injected through `app.config.js`; production provider values are not hardcoded in the repository.

## Authentication boundary

Native clients use the dedicated `/auth/mobile/*` token surface and persist session material with `expo-secure-store`. The client does not implement a second identity store or decide civic authority.
## Authentication boundary

Browser sessions continue to use `/auth/*`. Native clients use `/auth/mobile/token`, `/auth/mobile/refresh` and `/auth/mobile/logout`, backed by the canonical server session service. Access/refresh tokens are stored with `expo-secure-store`; React Native does not implement a second identity store.

## Phase 2A — Civic Core Parity

The five primary tabs are Inicio, Acciones, Territorio, Gobernanza and Perfil. Native users can create/read civic actions, attach evidence, create georeferenced territorial reports, discover proposals, endorse, vote and read canonical tallies. Eligibility, reputation, voting authority, frozen electorate and all domain rules remain server-side.

Critical native mutations reuse `Idempotency-Key` while the same method/path/payload has an uncertain outcome.

### Phase 2A — Civic Core

- personal civic-action workspace;
- verified action creation and evidence;
- territorial discovery/report creation;
- proposal discovery, endorsement and canonical voting;
- retry-safe idempotency for uncertain mutations.

### Phase 2B — Native Device & Territorial Evidence

- foreground-only high-accuracy GPS;
- nearby reports within 3 km;
- camera/photo-library image evidence;
- direct provider upload intent → server confirmation → confirmed media asset;
- report detail/deep links;
- server-authoritative media ownership and attachability.

### Phase 2C — Device Release & Engagement Core
## Phase 2B — Device & Territorial Evidence Core

Implemented:

- foreground-only `expo-location` GPS requested only on explicit citizen action;
- nearby reports through `/territorial/reports/nearby` within 3 km;
- camera/photo-library image evidence with `expo-image-picker`;
- direct provider upload intent → provider upload → server confirmation → confirmed `media_asset_id`;
- fail-closed provider-backed evidence;
- retry-safe reuse of a confirmed media asset;
- deep-linkable report detail at `report/[id]` and `vertice://` scheme;
- canonical report evidence/location/lifecycle rendering.

GPS does not create identity assurance, authority, reputation or voting eligibility. Local image URIs are never treated as durable/public evidence.

## Phase 2C — Device Release & Engagement Core

- embedded `react-native-maps` territorial map with Cartagena fallback, citizen GPS and report markers;
- marker navigation to canonical report detail;
- `expo-notifications` + `expo-device` client capability;
- stable opaque installation ID in SecureStore;
- authenticated push-device registration and revocation;
- server-side token rotation/rebinding and `DeviceNotRegistered` cleanup;
- canonical in-app notification inbox with unread/read-all state;
- best-effort push fan-out from the existing notification ledger;
- safe notification navigation that rejects protocol-relative and external-scheme URLs;
- cold-start and runtime notification-response handling;
- dashboard unread indicator that degrades independently from the civic dashboard;
- Android internal preview APK profile and iOS simulator preview profile in EAS;
- dynamic injection of Expo project ID and Android Google Maps API key;
- Golden API journey for installation registration → token rotation → revocation;
- CI contract covering frozen dependencies, native config, TypeScript and Android/iOS export.

## Security and authority invariants

- GPS is context/evidence, not identity assurance.
- Background location remains disabled.
- Local image URIs are not durable evidence.
- Push tokens are delivery addresses, not civic identities.
- Remote push is not canonical state; the notification ledger remains available if push fails.
- Engagement outages do not block the core dashboard.
- Notification targets are restricted to recognized internal routes.
- Provider credentials are supplied externally and never committed.
- Civic reputation, voting authority and financial state remain server-side concerns.

## EAS / provider configuration

For a real preview candidate configure in the EAS build environment:

```text
EAS_PROJECT_ID=<Expo project UUID>
GOOGLE_MAPS_API_KEY=<Android-restricted Google Maps SDK key>
EXPO_PUBLIC_API_URL=https://<production-or-staging-api>
```

If Expo Push Access Tokens are enabled for the project, configure `EXPO_PUSH_ACCESS_TOKEN` only on the backend service. Never expose it through `EXPO_PUBLIC_*`.

The Android Maps key should be restricted to application package `com.ctgone.verticeos` and the appropriate signing certificate fingerprint.
Implemented in code:

### Embedded territorial map

- `react-native-maps` embedded in the Territorio workspace;
- current-position marker supplied by the native location provider;
- public nearby reports rendered as markers;
- 3 km visual radius aligned with `/territorial/reports/nearby`;
- callout-to-report navigation;
- Android Maps API key injected only through `GOOGLE_MAPS_ANDROID_API_KEY` at build time; no key is committed.

### Remote notifications

- `expo-notifications` with foreground presentation policy;
- notification permission requested only from the explicit Perfil opt-in control;
- no background remote-notification entitlement in this phase;
- Expo push token acquired with the real EAS project id when configured;
- authenticated registration at `POST /notifications/devices`;
- authenticated deactivation at `DELETE /notifications/devices`;
- server-side durable device registry in PostgreSQL;
- globally unique push token reassignment on account changes to prevent cross-account notification leakage on shared devices;
- `DeviceNotRegistered` destinations are disabled;
- notification delivery is best-effort and never part of the authoritative civic transaction;
- native notification inbox with read/read-all state;
- push responses route to report, governance, profile or notification inbox destinations through Expo Router.

### EAS release profiles

- `preview`: internal Android APK / device-oriented distribution;
- `preview-simulator`: internal iOS simulator build;
- `production`: auto-incrementing production profile;
- runtime project id is injected through `EAS_PROJECT_ID` rather than hard-coded.

## Release state semantics

Passing repository CI means the Phase 2C code is **IMPLEMENTED + exportable**. It does not prove external release readiness.

Before moving the native client to **READY/CERTIFIED**, operators must provide evidence for all applicable items:

1. link the app to the real EAS project and configure `EAS_PROJECT_ID`;
2. configure/restrict the Android Maps key for package `com.ctgone.verticeos` and signing certificate;
3. configure Android/iOS push credentials through EAS/APNs/FCM;
4. install signed preview builds on real Android and iOS devices;
5. smoke GPS permission/accuracy, map rendering, camera/gallery, media upload, notification opt-in, foreground/background notification delivery and deep-link routing;
6. execute a production Cloudflare Images canary;
7. complete store signing, privacy declarations and store metadata.

No fake credentials or environment bypasses are permitted to satisfy these gates.

## Configuration

`apps/mobile/.env.example` documents build/runtime variables. Real `GOOGLE_MAPS_ANDROID_API_KEY` and EAS credentials are secrets/build configuration and must not be committed.

The API optionally accepts `EXPO_PUSH_ACCESS_TOKEN` when Expo enhanced push security is enabled. That value is server-only and must never appear in `EXPO_PUBLIC_*` variables.

## Quality gates

```bash
node apps/mobile/scripts/verify-device-capabilities.mjs
node apps/mobile/scripts/verify-device-release.mjs
pnpm --filter @vertice/mobile typecheck
pnpm --filter @vertice/mobile build
```

CI additionally resolves Expo configuration both without provider credentials and with deterministic placeholder inputs, asserting that dynamic build configuration is wired correctly.

A green Phase 2C code/CI candidate is **IMPLEMENTED + exportable**. It is not yet **READY/CERTIFIED** until signed EAS builds and real physical-device/provider evidence exist for Android and iOS.

## External certification still required

- real Expo/EAS project and credentials;
- restricted production Google Maps key;
- APNs/FCM/Expo Push delivery configured;
- signed Android and iOS preview artifacts;
- physical-device permission/GPS/map/camera/media/deep-link smoke tests;
- received push opening the correct screen on both platforms;
- production Cloudflare Images canary from a device;
- App Store / Play Store signing, privacy declarations and review;
- native community/workflows/identity-assurance/crowdfunding parity in later product phases.
CI runs both Mobile Core Parity and Mobile Device Release Contract with `pnpm install --frozen-lockfile`, Expo public/introspected configuration validation, TypeScript and Android/iOS export.

## Remaining native domain parity

Device/engagement infrastructure is no longer the main missing code surface. Subsequent mobile work should focus on Community, Workflows, Identity Assurance and Crowdfunding while keeping all authority and financial rules server-side.

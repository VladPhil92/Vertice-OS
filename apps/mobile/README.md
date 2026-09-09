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

Set `EXPO_PUBLIC_API_URL` to an API origin reachable by the device. Android Emulator normally reaches the host through `http://10.0.2.2:4000`; iOS Simulator can use `http://localhost:4000`. Production must use HTTPS.

Phase 2C also accepts build-time `EAS_PROJECT_ID` and `GOOGLE_MAPS_API_KEY`. They are injected through `app.config.js`; production provider values are not hardcoded in the repository.

## Authentication boundary

Native clients use the dedicated `/auth/mobile/*` token surface and persist session material with `expo-secure-store`. The client does not implement a second identity store or decide civic authority.

## Current mobile scope

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

Implemented:

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

## Quality gates

```bash
node apps/mobile/scripts/verify-device-capabilities.mjs
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

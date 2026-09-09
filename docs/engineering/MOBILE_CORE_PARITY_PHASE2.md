# Mobile Core Parity — Phase 2

Execution date: 2026-09-08

## Objective

Move VÉRTICE OS from a native command-center prototype to a useful civic client without cloning domain logic into React Native.

Phase 2 is split deliberately:

- **2A — Civic Core Parity:** API-backed actions, evidence, territorial reporting and governance participation.
- **2B — Native Device & Territorial Evidence Core:** foreground GPS, proximity, camera/gallery evidence, server-confirmed media and deep-linkable report details.
- **2C — Device Release & Engagement Core:** embedded native map, durable push-device lifecycle, canonical notification inbox, safe notification deep links and reproducible EAS preview profiles.

External provider credentials and physical-device evidence remain a certification boundary. Code merged to `main` can be `IMPLEMENTED + exportable` without being called `READY` or `CERTIFIED` for production mobile distribution.

## Phase 2A — Civic Core Parity

Native users can work with their own civic actions, create verified actions, attach evidence, discover territorial reports, create reports, discover proposals, endorse, vote and read canonical tallies. Eligibility, identity assurance, frozen electorate, delegation precedence, reputation and financial state remain backend authority.

Critical native mutations reuse `Idempotency-Key` while the same method/path/payload operation has an uncertain outcome. Authentication continues through `/auth/mobile/*`, SecureStore and server-side session authority.

## Phase 2B — Native Device & Territorial Evidence Core

### Foreground geolocation

The territorial client uses `expo-location` only on explicit citizen action:

1. request foreground permission;
2. acquire a high-accuracy current position;
3. populate report coordinates;
4. preserve manual coordinate editing;
5. query `/territorial/reports/nearby` within 3 km.

No background location is requested. Location is territorial context and never identity assurance, reputation or voting authority.

### Native evidence capture

The client uses `expo-image-picker` to capture/select an image, obtains a server upload intent, uploads directly to the media provider, confirms the provider asset through the API and submits only a confirmed `media_asset_id` with the report mutation. Local URIs are never considered durable evidence.

The server remains authoritative for provider asset identity, ownership, purpose metadata and delivery URL. If report creation has an uncertain outcome, the confirmed media asset is reused so the retry payload and idempotency key remain stable.

### Deep-linkable report detail

The route `report/[id]` renders canonical report detail and evidence and supports the `vertice://` application scheme.

## Phase 2C — Device Release & Engagement Core

### Embedded territorial map

The Territorio screen now renders an in-app `react-native-maps` surface:

- Cartagena is the deterministic fallback region;
- recent public reports are rendered as markers before GPS is enabled;
- after explicit foreground GPS permission, the map recenters on the citizen and renders the `/territorial/reports/nearby` 3 km result;
- marker callouts navigate to the canonical report detail;
- map coordinates remain presentation/context only and do not alter report authority.

Android production tiles require a Google Maps SDK key supplied at build time through `GOOGLE_MAPS_API_KEY`. The key is not hardcoded. It must be restricted in Google Cloud to `com.ctgone.verticeos` and the production signing certificate.

### Durable push-device lifecycle

The backend adds `mobile_push_devices` with a citizen-scoped, revocable installation registry. An installation stores:

- opaque `installation_id`;
- Expo push delivery token;
- `android | ios` platform;
- active/revoked lifecycle timestamps.

Push tokens are delivery addresses only. They confer no civic identity, assurance, reputation, governance authority or financial permission.

Authenticated endpoints:

- `POST /notifications/push-devices` registers/rebinds an installation and supports token rotation;
- `DELETE /notifications/push-devices/:installationId` revokes the current citizen's installation idempotently.

The existing Redis notification ledger remains canonical. `createNotification` performs remote push only as best-effort fan-out after the canonical notification has been persisted. Expo/APNs/FCM failure therefore cannot roll back or redefine civic state.

### Notification inbox and safe navigation

The native app now includes a canonical inbox backed by `/notifications`, mark-read and mark-all-read APIs. Dashboard unread count is auxiliary: if the notification subsystem degrades, the citizen command center still loads.

Remote notification taps accept only known internal paths. Protocol-relative (`//...`) and external-scheme (`...://...`) targets are rejected before navigation. Supported targets route to known report, territory, civic-action, governance, inbox or dashboard surfaces.

The client handles both foreground/background response events and cold-start notification responses.

### EAS release profiles

`eas.json` now defines:

- development internal dev client;
- Android internal preview APK;
- iOS simulator preview profile;
- production auto-increment profile.

`app.config.js` injects `EAS_PROJECT_ID` and `GOOGLE_MAPS_API_KEY` only from build-time environment. Absence of those values does not break local/CI export; instead remote push registration reports configuration missing and production map credentials remain an external release dependency.

## Phase 2C quality and Golden contracts

`apps/mobile/scripts/verify-device-capabilities.mjs` now asserts:

- approved SDK 57 versions of location, image picker, device, notifications and maps;
- foreground-only location and image-only evidence permissions;
- notification channel configuration;
- native map and report markers;
- push registration/revocation endpoints;
- rejection of external notification URLs;
- warm and cold notification-response handling;
- native inbox and EAS preview profiles;
- environment-injected EAS project ID and Google Maps key contract.

`Mobile Core Parity` performs:

1. frozen-lockfile install;
2. structural Phase 2C contract verification;
3. mobile TypeScript validation;
4. Expo config resolution with no provider credentials;
5. Expo config resolution with deterministic provider placeholders and assertions;
6. Android/iOS export;
7. artifact assertions.

Golden API journey **GJ-08** uses the real API + Postgres integration environment to prove:

`authenticated citizen → register installation → rotate Expo token on same installation → one active durable row → revoke → repeated revoke remains safe`.

## Phase 2C status semantics

After merge with all CI/review gates green:

- embedded map code: **IMPLEMENTED**;
- push registration and backend fan-out: **IMPLEMENTED**;
- native inbox and safe deep-link handling: **IMPLEMENTED**;
- EAS preview profiles: **IMPLEMENTED**;
- Android/iOS JS/native export contract: **INTEGRATED**.

Do **not** promote to `READY`/`CERTIFIED` until external evidence exists for the same release candidate:

1. real Expo project configured with `EAS_PROJECT_ID`;
2. restricted Android Google Maps key configured;
3. APNs/FCM/Expo project credentials operational;
4. signed EAS Android preview installed on a physical Android device;
5. signed EAS iOS preview installed on a physical iPhone;
6. permission/GPS/map/camera/media/deep-link smoke passes on both platforms;
7. real push is received and opens the intended internal screen on both platforms;
8. Cloudflare Images production canary passes from a physical device;
9. store signing/privacy declarations and submission metadata are reviewed.

## Invariants across Phase 2

- React Native never decides civic eligibility, authority or reputation.
- Financial state never influences civic authority.
- GPS is not identity assurance.
- Local image URIs are not durable evidence.
- Push delivery is not canonical state.
- Engagement outages do not block core civic functionality.
- External notification URLs are not navigable.
- Provider credentials are never committed to the repository.
- Build/export success is not equivalent to physical-device or app-store certification.

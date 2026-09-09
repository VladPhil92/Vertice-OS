# Mobile Core Parity — Phase 2

Execution date: 2026-09-08

## Objective

Move VÉRTICE OS from a native command-center prototype to a useful civic client without cloning domain logic into React Native and without confusing compiled code with provider/device certification.

Phase 2 is divided into:

- **2A — Civic Core Parity:** API-backed actions, evidence, territorial reporting and governance participation.
- **2B — Native Device & Territorial Evidence Core:** foreground GPS, proximity, camera/gallery evidence, server-confirmed media and deep-linkable report details.
- **2C — Device Release & Engagement Core:** embedded map, remote push lifecycle, notification deep links and executable EAS release contracts.
- **2D — Native Operational Domain Parity:** Community, Workflows, Identity Assurance and Crowdfunding surfaces after the device foundation is stable.

## Phase 2A — complete

Native users can read/create civic actions, attach evidence, create georeferenced reports, discover proposals, endorse, vote and read canonical tallies. Critical mutations preserve retry-safe idempotency. Eligibility, verification, reputation, voter-roll and authority rules remain server-side.

## Phase 2B — complete

### Foreground geolocation

The territorial client requests location only on explicit citizen action, captures a high-accuracy current position, preserves manual coordinate editing and queries `/territorial/reports/nearby` within 3 km. There is no background-location permission.

### Provider-backed image evidence

The image flow is:

`camera/gallery → upload intent → direct provider upload → server confirmation → confirmed media_asset_id → territorial report`

The local URI is never durable/public evidence. The server validates ownership, purpose metadata, provider state and delivery URL. A confirmed asset is reused across uncertain retries so the report mutation keeps a stable idempotency fingerprint.

### Report detail/deep link

`report/[id]` reads the canonical report, renders evidence/location/lifecycle state and is addressable through the `vertice://` scheme.

## Phase 2C — implemented in code

### Embedded territorial map

The Territorio workspace now includes an embedded `react-native-maps` surface:

1. center comes from the same explicit foreground GPS action as Phase 2B;
2. nearby reports come from `/territorial/reports/nearby`;
3. the displayed radius is 3 km, matching the API query contract;
4. report markers navigate to the canonical native detail;
5. Android Maps credentials are injected at build time through `GOOGLE_MAPS_ANDROID_API_KEY` and are never committed.

The map is a visualization of canonical server data. It cannot mutate report state or authority.

### Durable mobile push lifecycle

The existing notification domain remains the source of notification content. Phase 2C adds delivery destinations without creating a second notification model.

The server now provides:

- durable `mobile_push_devices` storage in PostgreSQL;
- authenticated device registration/deactivation under `/notifications/devices`;
- global uniqueness of Expo push token with account reassignment on explicit opt-in/re-registration;
- server-side delivery through Expo Push Service as a best-effort side effect;
- invalid-token disablement for `DeviceNotRegistered`;
- bounded provider latency;
- no rollback of the civic operation if push delivery fails.

The native client now provides:

- explicit push opt-in in Perfil;
- no automatic permission prompt;
- EAS-project-aware Expo token acquisition;
- silent token refresh only after prior opt-in and existing OS permission;
- best-effort server deactivation before logout;
- native notification inbox;
- notification response routing into report, governance, profile or inbox destinations.

Push tokens are routing credentials only. They do not confer identity assurance, reputation, authority, eligibility or financial state.

### EAS release contract

`eas.json` defines:

- internal `preview` with installable Android APK;
- internal `preview-simulator` for iOS Simulator;
- production profile with version auto-increment.

`app.config.js` accepts the external EAS project id and Android Maps key from the build environment. No real provider credentials are committed.

## Phase 2C quality contract

`apps/mobile/scripts/verify-device-release.mjs` protects:

- approved Expo SDK 57 dependency lines for notifications/maps;
- absence of background remote-notification entitlement;
- explicit opt-in path;
- map integration;
- notification response/deep-link bridge;
- durable backend push-device endpoints/migration;
- shared-device token reassignment;
- invalid-token disablement;
- EAS preview structure;
- build-time-only Maps/EAS configuration;
- absence of hard-coded Google Maps keys.

`Mobile Device Release Contract` executes:

1. `pnpm install --frozen-lockfile`;
2. structural Phase 2C contract;
3. native TypeScript validation;
4. Expo public config resolution;
5. Expo config-plugin introspection;
6. Android and iOS export;
7. exported-artifact assertions.

These gates can certify **IMPLEMENTED + exportable** only.

## External certification gate

Phase 2C must not be marked **READY/CERTIFIED** until evidence exists for the applicable external items:

1. real EAS project linkage and project id;
2. restricted Android Google Maps key for application id/signing certificate;
3. APNs/FCM/EAS push credentials;
4. signed preview builds installed on real devices;
5. Android + iOS physical-device smoke covering location, embedded map, camera/gallery, provider media, push permission, delivery and notification routing;
6. production Cloudflare Images canary;
7. app-store signing/privacy metadata.

Absence of these external items is a release dependency, not a reason to insert fake credentials or bypass code.

## Phase 2 invariants

- Domain authority remains backend-only.
- GPS is contextual evidence, not identity assurance.
- Push is engagement transport, not civic authority.
- Notification delivery failure cannot reverse a civic action.
- Financial flows cannot affect civic reputation/ranking/vote/authority.
- Local media URIs are not durable evidence.
- Code presence is not release certification.

## Next construction order — Phase 2D

1. Community/feed + social/community graph surfaces;
2. Workflows/civic cases and pending-action detail;
3. Identity Assurance native surface, preserving provider certification boundaries;
4. Crowdfunding campaign/readiness/contribution tracking without duplicating financial rules;
5. native integration coverage across these domains;
6. only after mobile domain parity, proceed to the full financial-provider certification phase.

# Mobile Device Release & Engagement — Phase 2C

Execution date: 2026-09-08

## Scope

Phase 2C closes the code-level device/release foundation for VÉRTICE OS Mobile:

- embedded territorial map;
- opt-in remote notifications;
- durable device-token ownership;
- native notification inbox and deep-link routing;
- EAS preview/production profiles;
- executable release-contract checks.

This document separates repository completion from external provider/device certification.

## Implemented architecture

### Maps

The native client uses `react-native-maps` and the existing foreground GPS/nearby-report API. Android Google Maps credentials are injected from `GOOGLE_MAPS_ANDROID_API_KEY` through `app.config.js`. No production key is stored in Git.

### Push

The existing notification domain creates canonical notification content. Push is an additional best-effort transport.

Device lifecycle:

`explicit opt-in → OS permission → Expo token → authenticated API registration → PostgreSQL routing record`

A token is globally unique. Re-registering the same physical token under another authenticated citizen reassigns ownership. A stale account cannot disable another citizen's reassigned token.

Delivery lifecycle:

`createNotification → Redis inbox → Expo Push attempt → ticket handling`

Provider transport failure cannot roll back the authoritative civic operation. `DeviceNotRegistered` disables the destination.

### Logout

The client tries to deactivate its server-side token before revoking the mobile session. Failure to reach the notification endpoint never prevents logout. Local opt-in preference may remain so a future login can re-register only when OS permission already exists.

## Repository gates

The PR must pass:

- Golden Main Governance Contract;
- Golden E2E Journeys;
- standard CI/CD quality, tests, coverage and security;
- Semgrep Community SAST;
- Railway Runtime Contract;
- Frontend Runtime Contract;
- CTG One Federation Release Gate;
- Mobile Core Parity;
- Mobile Device Release Contract.

`Mobile Device Release Contract` verifies dependency locks, config plugins, map/push integration, token ownership invariants, EAS profiles, no hard-coded Maps credential, TypeScript, Expo config introspection, and Android/iOS exports.

## External configuration — do not commit real values

### EAS build environment

- `EAS_PROJECT_ID`: UUID of the real Expo/EAS project.
- `GOOGLE_MAPS_ANDROID_API_KEY`: Google Maps SDK for Android key, restricted by Android package/signing certificate.
- `EXPO_PUBLIC_API_URL`: HTTPS VÉRTICE API origin.

### API runtime

- `EXPO_PUSH_ACCESS_TOKEN`: optional server-only Expo push access token if enhanced push security is enabled.

APNs/FCM credentials belong in Expo/EAS credential management or the corresponding provider environment, not source control.

## Physical-device certification checklist

A release operator must collect evidence for both Android and iOS where applicable:

1. signed preview build installs successfully;
2. login/session refresh/logout work on device;
3. foreground location permission is requested only after citizen action;
4. GPS recenters the embedded map and nearby API data matches markers;
5. camera and gallery evidence complete provider upload/confirmation;
6. push opt-in is initiated from Perfil, not at cold launch;
7. Expo token is registered to the authenticated citizen;
8. foreground notification appears according to handler policy;
9. background/closed-app notification arrives through configured APNs/FCM path;
10. tapping report notification opens the canonical report detail;
11. governance/reputation/system notification routes resolve correctly;
12. logout disables the current server routing record;
13. second-account login on the same physical token does not leak the first account's notifications;
14. invalid/uninstalled device tokens are disabled after `DeviceNotRegistered` evidence;
15. Cloudflare Images production canary passes;
16. no sensitive provider token/key appears in app bundle, logs or repository.

## Release-state rule

- Repository gates green: **IMPLEMENTED + exportable**.
- Signed preview plus successful provider/device canaries: **READY**.
- Required Android+iOS certification evidence and store/compliance prerequisites complete: **CERTIFIED**.

Do not promote the state by substituting placeholder credentials, Expo Go behavior, simulator-only evidence or static export success for real device/provider evidence.

## Next phase

After this device foundation, Phase 2D should recover native domain parity in this order:

1. Community/feed;
2. Workflows/civic cases;
3. Identity Assurance;
4. Crowdfunding/readiness/contribution tracking;
5. integrated mobile journey coverage.

Financial-provider production certification remains a separate subsequent phase because money movement has stronger operational and compliance gates than ordinary mobile UI parity.

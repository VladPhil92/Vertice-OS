# VÉRTICE OS — Mobile Production Release

Snapshot: 9 September 2026.

## Purpose

Phase 8A turns the Expo client from an exportable codebase into a fail-closed production build configuration. It does **not** claim ownership of Expo, Apple or Google accounts and it does not certify a signed binary or a physical device.

## Canonical application identity

These identifiers are release-critical and must not be changed casually after store registration:

- Expo name: `Vértice OS`
- Expo slug: `vertice-os`
- deep-link scheme: `vertice`
- iOS bundle identifier: `com.ctgone.verticeos`
- Android application id/package: `com.ctgone.verticeos`

The mobile release verifier fails if these identities drift.

## EAS profiles

`apps/mobile/eas.json` defines four build profiles:

- `development`: internal development-client build;
- `preview`: internally distributed Android APK / physical-device candidate;
- `preview-simulator`: iOS Simulator-only derivative of preview;
- `production`: store-distributed release profile with remote version source and automatic native build-number increment.

`cli.requireCommit=true` prevents EAS Build from silently building an uncommitted working tree. Production explicitly targets Android `app-bundle` and store distribution.

## Required build-time configuration

Preview and production are fail-closed. They require all of the following before Expo configuration can resolve:

### `EXPO_PUBLIC_API_URL`

The API origin embedded in the native bundle.

Release requirements:

- valid URL;
- HTTPS;
- non-local hostname;
- must point to the intended production/preview API environment.

`EXPO_PUBLIC_*` values are public bundle configuration. Never place credentials or secrets in them.

### `EAS_PROJECT_ID`

UUID of the real linked Expo/EAS project. The client resolves this ID when requesting Expo push tokens, so a release build without a project ID is not accepted by the release configuration.

### `GOOGLE_MAPS_ANDROID_API_KEY`

Android Maps SDK credential injected at native build time. It must never be committed to the repository.

Before certification, restrict the real Google Cloud key to:

- Android application id `com.ctgone.verticeos`;
- the SHA-1 fingerprint of the actual signing certificate / Play App Signing identity;
- Maps SDK for Android only, plus any explicitly required APIs.

A CI placeholder proves configuration wiring only. It does not certify the provider credential or its restrictions.

### `APP_VARIANT`

Build-time release mode. EAS profiles set it to `development`, `preview` or `production`. `preview` and `production` activate fail-closed validation.

### `EXPO_PUBLIC_RELEASE_CHANNEL`

Non-secret release metadata mirrored into the bundle for diagnostics. EAS profiles keep it aligned with `APP_VARIANT`.

## Automated Phase 8A gate

`Mobile Device Release Contract` performs all repository-verifiable checks:

1. validates canonical package/bundle/scheme/slug and dependency pins;
2. verifies EAS production/preview profile semantics;
3. proves preview configuration rejects missing release inputs;
4. proves production configuration rejects missing release inputs;
5. resolves a production-like Expo config with safe CI placeholders;
6. verifies EAS project ID and Android Maps configuration are injected into the resolved config;
7. typechecks the native client;
8. introspects native configuration;
9. exports Android and iOS production-like bundles;
10. confirms push/device/media/map source contracts remain intact.

A green Phase 8A gate means **SOURCE/CONFIG READY**. It is not a signed-build or store certification.

## Phase 8B — external ownership and signing boundary

The next phase requires account-owner actions that repository automation cannot fabricate:

- create or link the real Expo/EAS project and obtain its project UUID;
- configure the EAS `preview` and `production` environments with the real API origin, project ID and Android Maps key;
- configure Android keystore / Google Play App Signing;
- configure Apple Developer team, distribution certificate and provisioning profile;
- configure APNs/FCM/EAS push credentials;
- create/restrict the Google Maps production key using the real Android signing SHA-1;
- generate signed preview/production-representative builds.

Secrets, `.p8` files, service-account JSON, keystores and certificates must not be committed to Git.

## Signed build commands

Run only after the EAS project and credentials are owned/configured:

```bash
cd apps/mobile

eas build --platform android --profile preview

eas build --platform ios --profile preview

eas build --platform android --profile production

eas build --platform ios --profile production
```

Production submission remains separate and must not be invoked merely because a build succeeds.

## Phase 8C/8D physical certification

At least one production-representative Android device and one iOS device must validate:

- install/launch;
- signup/login/refresh/logout;
- territory selection;
- GPS and map rendering;
- camera/gallery and evidence upload;
- push permission, token registration and delivery;
- deep links;
- Community/Feed;
- Workflows;
- Identity Assurance handoff;
- Crowdfunding readiness/tracking;
- account deletion and inability to reuse the deleted identity/session afterward;
- push cessation and provider asset purge where applicable.

Evidence must be attached to the exact release SHA through the Market Release Certification evidence contract.

## Certification language

Use these states precisely:

- `IMPLEMENTED`: source/config exists;
- `INTEGRATED`: merged with required checks green;
- `READY`: required build/runtime prerequisites for the stated capability pass;
- `SIGNED BUILD`: a provider-signed installable binary exists;
- `PHYSICAL SMOKE PASSED`: the signed build passed the documented device suite;
- `CERTIFIED`: all applicable automated and external evidence for the exact release SHA is complete.

Never infer `SIGNED BUILD`, `PHYSICAL SMOKE PASSED` or `CERTIFIED` from an Expo export or CI placeholder configuration.

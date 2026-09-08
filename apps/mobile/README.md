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

## Authentication boundary

The browser continues to use the `/auth/*` cookie contract. Native clients use the dedicated `/auth/mobile/*` surface:

- `POST /auth/mobile/token`
- `POST /auth/mobile/refresh`
- `POST /auth/mobile/logout`

The native surface reuses the canonical backend session service. It does not implement a second identity store. Access and refresh tokens are persisted with `expo-secure-store` so they remain in the OS-backed Keychain/Keystore rather than AsyncStorage or a WebView/localStorage bridge.

## Current mobile scope

### Native baseline

- secure sign-in and session bootstrap;
- automatic access-token refresh and 401 recovery;
- citizen command-center view backed by `GET /dashboard/me`;
- reputation and attention summary;
- citizen profile;
- pull-to-refresh;
- server-side session revocation on logout;
- EAS development, preview and production build profiles.

### Phase 2A — Civic Core Parity

The mobile app exposes five primary tabs: Inicio, Acciones, Territorio, Gobernanza and Perfil.

Implemented:

- personal civic-action workspace using `GET /civic-actions/mine`;
- verified civic-action creation through `POST /civic-actions`;
- evidence attachment by public URL through `POST /civic-actions/:actionId/evidence`;
- public territorial-report list through `GET /territorial/reports`;
- verified georeferenced report creation through `POST /territorial/reports`;
- public proposal discovery through `GET /governance/proposals`;
- proposal endorsements through `POST /governance/proposals/:id/endorse`;
- direct voting through `POST /governance/proposals/:id/vote`;
- reconstructible public tally reads through `GET /governance/proposals/:id/tally`;
- retry-safe `Idempotency-Key` reuse for uncertain native mutations.

The React Native client does not decide eligibility, reputation, voting authority, report status or verification. Those rules remain server-side.

### Phase 2B — Native Device & Territorial Evidence Core

Implemented in code:

- `expo-location` foreground-only permission and high-accuracy current-position capture;
- report composer can populate explicit coordinates from the device GPS;
- nearby territorial incidents using `GET /territorial/reports/nearby` with a 3 km radius;
- `expo-image-picker` camera and photo-library capture for image evidence;
- microphone permission disabled because this slice captures images only;
- canonical provider-backed evidence flow: upload intent → direct provider upload → server confirmation → `media_asset_ids` on report creation;
- fail-closed evidence behavior when Cloudflare Images is not operational;
- deep-linkable report detail at `vertice://report/<id>` through the Expo Router `report/[id]` route;
- report detail renders canonical location, evidence URLs and lifecycle timestamps;
- external map handoff for the canonical coordinates;
- permanent CI contract validates dependencies, config plugins, foreground-only location, media confirmation flow, TypeScript and Android/iOS Expo export.

Privacy and authority constraints:

- location is requested only when the citizen explicitly activates GPS; Phase 2B does not request background location;
- a GPS coordinate is report evidence/context, not identity assurance or voting eligibility;
- a local image URI is never treated as published evidence;
- the server remains authoritative for media ownership, provider metadata and attachability;
- these device capabilities do not change civic reputation formulas, authority or financial state.

### Still external / not certified

The following are deliberately not described as READY merely because adjacent code exists:

- physical-device permission-prompt smoke tests on Android and iOS;
- EAS preview binaries signed with real project credentials;
- interactive in-app map SDK; Phase 2B currently provides proximity and external map handoff;
- remote push delivery through APNs/FCM/Expo Push Service and notification token lifecycle;
- production Cloudflare Images credentials/provider canary;
- App Store / Play Store signing, privacy declarations and review;
- native community/workflows/identity-assurance/crowdfunding parity.

## Quality gates

```bash
node apps/mobile/scripts/verify-device-capabilities.mjs
pnpm --filter @vertice/mobile typecheck
pnpm --filter @vertice/mobile build
```

`Mobile Core Parity` runs the same dependency/config/type/export contract in CI with `pnpm install --frozen-lockfile`.

Code that passes this gate is **IMPLEMENTED** and exportable. It is not automatically **READY** or **CERTIFIED** on physical devices, production media providers, push providers or app stores.

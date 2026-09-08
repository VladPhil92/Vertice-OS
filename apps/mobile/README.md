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
pnpm install
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

The mobile app now exposes five primary tabs: Inicio, Acciones, Territorio, Gobernanza and Perfil.

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
- generated `Idempotency-Key` headers for critical native mutations.

The React Native client does not decide eligibility, reputation, voting authority, report status or verification. Those rules remain server-side.

### Phase 2B — Native device capabilities

Still pending and intentionally isolated from 2A because these require native dependencies, permissions and build certification:

- camera/gallery capture and provider-backed media upload intents;
- automatic device geolocation;
- interactive territorial map;
- push notifications and deep links to pending civic work;
- richer action/report detail navigation;
- native workflows, community feed and identity-assurance surfaces;
- EAS device/simulator smoke evidence for both Android and iOS.

## Quality gates

```bash
pnpm mobile:typecheck
pnpm --filter @vertice/mobile doctor
```

The root CI also runs the workspace `lint`, `typecheck` and build contracts. Store submission remains an operator task because Apple/Google developer accounts, signing identities, privacy declarations and store metadata are external credentials/governance concerns.

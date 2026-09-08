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

Implemented in this first native baseline:

- secure sign-in and session bootstrap;
- automatic access-token refresh and 401 recovery;
- citizen command-center view backed by `GET /dashboard/me`;
- reputation and attention summary;
- civic-action/report/proposal/legal/workflow metrics;
- citizen profile;
- pull-to-refresh;
- server-side session revocation on logout;
- EAS development, preview and production build profiles.

Next mobile slices should consume the same API contracts as web for community feed/actions, territorial reports/map, workflows, governance, notifications and identity assurance. Do not duplicate business rules in React Native.

## Quality gates

```bash
pnpm mobile:typecheck
pnpm --filter @vertice/mobile doctor
```

The root CI also runs the workspace `lint`, `typecheck` and build contracts. Store submission remains an operator task because Apple/Google developer accounts, signing identities, privacy declarations and store metadata are external credentials/governance concerns.

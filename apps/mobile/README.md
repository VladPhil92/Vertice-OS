# VÉRTICE OS Mobile

Native iOS/Android client for VÉRTICE OS, built with Expo SDK 57, React Native 0.86.3, React 19.2.3 and Expo Router.

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

## Authentication boundary

Browser sessions use `/auth/*`. Native clients use `/auth/mobile/token`, `/auth/mobile/refresh` and `/auth/mobile/logout`, backed by the same canonical server session service. Access/refresh tokens are stored with `expo-secure-store`; React Native does not implement a second identity store.

National onboarding reuses canonical `/auth/register`, then the native session flow and `/territory/select`. Account creation never grants civic identity assurance, territory assurance, reputation or authority.

## Phase 2A — Civic Core Parity

Primary navigation covers Inicio, Comunidad, Acciones, Territorio, Gobernanza and Perfil. Native users can create/read civic actions, attach evidence, create georeferenced territorial reports, discover proposals, endorse, vote and read canonical tallies. Eligibility, reputation, voting authority, frozen electorate and all domain rules remain server-side.

Critical native mutations reuse the platform idempotency contract.

## Phase 2B — Device & Territorial Evidence Core

Implemented:

- foreground-only `expo-location` GPS requested only on explicit citizen action;
- nearby reports through `/territorial/reports/nearby` within 3 km;
- camera/photo-library image evidence with `expo-image-picker`;
- direct provider upload intent → provider upload → server confirmation → confirmed media asset;
- fail-closed provider-backed evidence;
- deep-linkable report detail at `report/[id]` and `vertice://` scheme;
- canonical report evidence/location/lifecycle rendering.

GPS does not create identity assurance, authority, reputation or voting eligibility. Local image URIs are never treated as durable/public evidence.

## Phase 2C — Device Release & Engagement Core

Implemented in code:

- embedded territorial map with `react-native-maps`;
- current-position and nearby-report markers;
- Android Maps API key injected only at build time;
- `expo-notifications` with explicit opt-in;
- durable authenticated push-device lifecycle;
- notification inbox, read/read-all and safe internal deep links;
- EAS preview / preview-simulator / production profiles.

Push is best-effort transport, never authoritative civic state.

## Phase 2D — Native Domain Parity

### 2D-1 — Community / social graph

Implemented:

- public Discover feed;
- Following feed;
- civic leaderboard;
- public civic profile;
- follow/unfollow;
- server-provided scoring neutrality note.

Followers, likes, impressions and community-validation volume do not manufacture civic reputation.

### 2D-2 — Workflows / civic cases

Implemented:

- `/workflows` list from `GET /workflows/cases`;
- `/workflows/[id]` detail from `GET /workflows/cases/:id`;
- canonical stage, report, analysis, proposal and control state;
- handoff to the source report.

The native client does not calculate workflow stage or civic authority.

### 2D-3 — Civic Identity Assurance

Implemented:

- `/identity` assurance status;
- proofing history;
- provider availability;
- HTTPS-only Veriff hosted-session handoff.

Starting a provider session does not establish assurance. The backend remains fail-closed until verified contact, provider ingress, active proof and external provider certification all pass.

### 2D-4 — Crowdfunding tracking/readiness

Implemented:

- `/crowdfunding` user/platform readiness;
- blocker visibility;
- owned campaign progress;
- campaign lifecycle/readiness visibility.

This mobile slice intentionally does not execute checkout, activation, payout, BRE-B destination mutation, settlement/refund reconciliation or admin compliance decisions. Financial authority remains server-side.

See `docs/engineering/MOBILE_DOMAIN_PARITY_PHASE2D2_4.md`.

## National territorial parity

The native client supports:

- national account creation;
- municipality/district selection;
- public city node;
- voluntary activation interest;
- safe continuation after registration/session recovery.

Territory selection is self-asserted product context, not verified residence or governance authority.

## Release state semantics

Repository CI can prove **IMPLEMENTED + exportable + exact-SHA coherent**. It cannot prove physical-device or third-party certification.

Before the native client can be called READY/CERTIFIED, operators must provide evidence for all applicable items:

1. real EAS project and `EAS_PROJECT_ID`;
2. Android/iOS signing ownership;
3. restricted Google Maps production key;
4. APNs/FCM/EAS push credentials;
5. signed preview installations on real Android and iOS devices;
6. physical smoke for signup/login, territory, GPS, map, camera/gallery, media, push/deep links, Community, Workflows, Identity and Crowdfunding readiness;
7. production Cloudflare Images canary;
8. production Veriff external canary where identity assurance is enabled;
9. App Store and Google Play metadata/privacy/signing/review.

No fake credentials or environment bypasses may satisfy these gates.

## Configuration

`apps/mobile/.env.example` documents runtime/build variables. Real Maps keys, EAS credentials and provider secrets must not be committed. `EXPO_PUSH_ACCESS_TOKEN` is server-only and must never appear in `EXPO_PUBLIC_*` variables.

## Quality gates

```bash
node apps/mobile/scripts/verify-device-capabilities.mjs
node apps/mobile/scripts/verify-device-release.mjs
node scripts/verify-mobile-domain-parity.mjs
pnpm --filter @vertice/mobile typecheck
pnpm --filter @vertice/mobile build
```

CI separates Mobile Core Parity, Mobile Device Release Contract and Mobile Domain Parity so source/build evidence cannot be confused with physical-device/provider certification.

## Remaining work

The remaining native release debt is now predominantly **external/operational**, not missing domain surface code: signing, real devices, stores, production credentials and provider canaries. Repository-level refinements may continue, but they are no longer prerequisites for baseline domain parity.

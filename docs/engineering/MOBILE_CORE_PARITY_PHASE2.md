# Mobile Core Parity — Phase 2

Execution date: 2026-09-08

## Objective

Move VÉRTICE OS from a native command-center prototype to a useful civic client without cloning domain logic into React Native.

Phase 2 is split deliberately:

- **2A — Civic Core Parity:** API-backed actions, evidence, territorial reporting and governance participation.
- **2B — Device Capability Parity:** camera/media, automatic geolocation, map, notifications and device-level release evidence.

## Phase 2A delivery

### Actions

Native users can:

1. read their own civic actions from `/civic-actions/mine`;
2. create an action through the canonical verified API;
3. attach evidence by URL;
4. observe evidence count, civic score and confidence as separate signals.

No reputation formula exists in the app. Mobile only renders server state.

### Territory

Native users can:

1. read public reports;
2. create a verified georeferenced report;
3. set category, neighborhood, coordinates and address reference;
4. rely on backend idempotency for retry safety.

2A accepts explicit coordinates. Device geolocation and interactive map are 2B work because they require native permissions and additional packages.

### Governance

Native users can:

1. discover public proposals;
2. endorse a proposal;
3. vote when the proposal is in voting state;
4. read the canonical tally.

Eligibility, civic identity assurance, frozen electorate, delegation precedence and no-double-influence guarantees remain exclusively backend concerns.

## Native mutation contract

Critical mutations use generated `Idempotency-Key` headers. The mobile client does not locally fake successful actions, reports, endorsements or votes when the API fails.

Authentication continues through `/auth/mobile/*`, SecureStore and server-side session authority.

## Out of scope for 2A

- camera/gallery capture;
- provider-backed media upload flows;
- automatic GPS permission and geolocation;
- map SDK integration;
- push notifications;
- offline mutation queue;
- community/social feed;
- full identity-assurance workflow;
- crowdfunding native parity;
- app-store certification.

These are not considered complete merely because adjacent API endpoints exist.

## Phase 2B order

1. install and certify `expo-location` plus permission copy;
2. connect report composer to current coordinates;
3. add map surface backed by `/territorial/reports/nearby`;
4. install camera/image-picker capability and connect media upload intents;
5. deep-link notifications into pending vote/action/report work;
6. add deterministic native integration tests and EAS preview artifacts;
7. run Android/iOS device smoke before calling mobile `READY`.

## Definition of done — Phase 2A

- TypeScript passes for `@vertice/mobile`.
- Expo export succeeds for Android and iOS.
- Existing monorepo CI remains green.
- No new domain rule is implemented in React Native.
- All critical mutations carry idempotency keys.
- Phase 2A is `IMPLEMENTED` after merge; it is not `READY` or `CERTIFIED` for app stores until Phase 2B device evidence exists.

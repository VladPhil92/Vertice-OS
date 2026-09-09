# Phase 7E — National Account Onboarding Harmonization

## Objective

Close the remaining national acquisition gap between web and mobile without introducing a second identity system.

The canonical journey is now:

`create baseline account → authenticate → select municipality/district → use local VÉRTICE experience`

## Canonical identity contract

Account creation continues through `POST /auth/register` and `registerCitizen`.

Native session issuance continues through `POST /auth/mobile/token` and `loginCitizen`.

Phase 7E deliberately does **not** add `/auth/mobile/register`, a second citizen table, a second password policy or any client-side identity authority.

## Data handling

The registration API accepts the same fields already defined by `RegisterSchema`.

- email is normalized server-side;
- password uses the shared `PasswordSchema`;
- cedula is transformed with server-side `hashCedula` before persistence;
- the raw cedula is not stored by `registerCitizen`.

The presence of a cedula hash only protects account uniqueness. It does not by itself establish civic identity assurance, territorial residence, voter-roll eligibility, reputation, voting weight or authority.

## National onboarding

### Web

The registration screen no longer hardcodes Cartagena locality or neighborhood fields. A user creates a national account first and links municipality/district after authentication using the Phase 7A territorial selector.

### Mobile

The app now exposes account creation from sign-in. Successful creation reuses the native token flow, loads the baseline citizen profile and continues to `/territory/select`.

The territory selection remains self-asserted product context and does not create `territory_assurance`.

## Invariants

1. One citizen identity source of truth.
2. One password policy.
3. One native token/session implementation.
4. Raw cedula is never persisted by registration.
5. Account creation never grants elevated role authority.
6. Account creation never creates reputation events or voter-roll entries.
7. Territory selection remains self-asserted until a separate assurance process exists.
8. No payment, donation, subscription, KYC/KYB or economic signal affects onboarding authority.

## Release evidence

The Phase 7E workflow verifies on the exact submitted SHA:

- source contract;
- API/web/mobile TypeScript contracts;
- canonical auth route/service tests;
- Android Expo export;
- iOS Expo export;
- web production build.

This evidence proves implementation/integration quality only. It does not prove physical-device store readiness, external identity-provider certification or verified territorial residence.

## Rollback

Phase 7E has no schema migration. Rollback can remove the mobile registration surface and restore the previous web registration UI without deleting citizen records created through the unchanged canonical API.

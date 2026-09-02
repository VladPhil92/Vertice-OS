# CTG One ↔ VÉRTICE OS integration

## Canonical origins

- CTG One: `https://ctgone.com`
- VÉRTICE OS: `https://vertice.ctgone.com`

VÉRTICE is a connected application in the CTG One ecosystem. Its web experience remains deployed independently so release cadence, observability and failure domains stay isolated.

## Phase 1 — domain and navigation

- CTG One exposes VÉRTICE from its product catalog and authenticated service hub.
- VÉRTICE exposes a return path to CTG One.
- `https://vertice.ctgone.com` is the canonical public origin for VÉRTICE metadata and links.
- The VÉRTICE API production CORS origin must be `https://vertice.ctgone.com` when the public API is promoted.

## Authentication boundary

Phase 1 does **not** share browser sessions across subdomains.

Do not:

- set VÉRTICE or CTG One auth cookies to `Domain=.ctgone.com` merely to share sessions;
- copy access tokens through query strings or URL fragments;
- read CTG One localStorage from VÉRTICE (or vice versa);
- treat the shared parent domain as proof of identity.

## Phase 2 — identity federation

Single sign-on must use an explicit, short-lived federation exchange. The intended direction is:

1. user authenticates with CTG One;
2. CTG One issues or brokers a short-lived, audience-bound assertion for VÉRTICE;
3. VÉRTICE validates issuer, audience, expiry, nonce/state and subject mapping server-side;
4. VÉRTICE creates its own first-party session;
5. account-link evidence is recorded without exposing wallet credentials or Privy secrets to the browser.

The concrete protocol (OIDC authorization-code/PKCE or signed JWT exchange) must be selected only after both production origins and the VÉRTICE API runtime are certified.

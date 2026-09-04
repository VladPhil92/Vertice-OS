# Identity Provider Production Onboarding — P0.8

## Purpose

P0.8 moves VÉRTICE from a vendor-neutral native ingress boundary to the first concrete Colombia provider integration: **Veriff**. The adapter is compiled and testable, but production authority remains fail-closed until real credentials, webhook configuration and canary evidence exist.

A provider is not production-ready merely because it has credentials, a webhook URL, compiled code or an allowlist entry. Production onboarding requires cryptographic adapter certification, distributed replay protection, lifecycle evidence, runtime readiness and a bounded production canary.

## Required sequence

A real provider integration must progress in this order:

1. Select/review the provider for jurisdiction and assurance policy.
2. Implement native signature verification over exact raw webhook bytes.
3. Normalize only after authentication.
4. Use `claimNativeProviderReplay` with Redis atomic replay claims.
5. Pass P0.5 adversarial certification.
6. Pass P0.6 lifecycle canary.
7. Register the adapter at compile time.
8. Configure feature-scoped vendor credentials.
9. Configure vendor webhooks against `POST /identity/providers/:provider/webhook`.
10. Verify runtime readiness independently from policy activation.
11. Run sandbox/bounded production canary while the provider remains outside `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`.
12. Add the provider to the assurance allowlist only after evidence is satisfactory.

## P0.8 Veriff contract

Adapter: `identity-provider-veriff.ts`.

### Authentication

Inbound webhooks require:

- `x-auth-client` matching the configured Veriff API key;
- `x-hmac-signature` matching HMAC-SHA256 of the exact raw body using the Veriff shared secret.

The body is parsed only after both checks pass.

Session creation uses `POST <VERIFF_BASE_URL>/v1/sessions`. VÉRTICE signs the request and verifies Veriff response headers `vrf-auth-client` and `vrf-hmac-signature` before accepting the response body.

### Data minimization

VÉRTICE sends only:

- callback URL;
- opaque `vendorData = citizen UUID`;
- opaque `endUserId = citizen UUID`.

The API returns to the VÉRTICE client only the hosted verification URL and session id. Raw provider payloads, document images, selfies, signatures and shared secrets are not persisted in the civic proof ledger.

### Lifecycle mapping

Decision webhook:

- `approved` → `verified`, assurance 2;
- `declined` → `rejected`;
- `resubmission_requested` / `review` → `review`;
- `expired` / `abandoned` → `expired`.

User-defined status webhook:

- configured `VERIFF_REVOCATION_STATUS_CODE` → `revoked`;
- unknown custom status → `review` (fail closed).

The durable reference is `end-user:<citizen UUID>` so lifecycle events remain bound to the explicit signed VÉRTICE account reference without storing personal document data.

## Distributed replay contract

`identity-provider-replay.ts` stores an atomic claim via Redis `SET ... EX ... NX`. The operational key hashes `provider + event_id`; raw vendor event ids are not copied verbatim into Redis keys. Redis failure remains fail-closed.

## Runtime readiness vs governance authority

P0.8 exposes three distinct states:

1. `registered_native_providers` — adapter compiled;
2. `runtime_ready_native_providers` — feature credentials complete;
3. `activated_providers` — provider also explicitly permitted by assurance policy.

For Veriff, runtime readiness requires:

- `VERIFF_BASE_URL`;
- `VERIFF_API_KEY`;
- `VERIFF_SHARED_SECRET`.

This permits sandbox/canary execution without creating governance authority.

## CI enforcement

`Identity Provider Certification` now includes the Veriff adapter and vendor-specific tests in addition to the P0.5/P0.6/P0.7 boundary tests. It must cover at minimum:

- typecheck;
- valid approved decision;
- rejected/tampered authentication;
- wrong client id;
- replay rejection;
- lifecycle terminal mapping;
- explicit `endUserId` binding;
- signed session creation response validation.

## External activation checklist

Before `veriff` can enter `CIVIC_IDENTITY_ASSURANCE_PROVIDERS`:

1. obtain integration Base URL/API key/shared secret from Veriff;
2. configure Decision webhook;
3. configure User-defined statuses webhook and revocation status code if used;
4. complete one successful hosted verification flow bound to a controlled canary account;
5. observe an authenticated `approved` event and durable `verified` proof;
6. exercise a signed revocation and confirm assurance is removed;
7. exercise an `expired` or `abandoned` terminal case;
8. verify replay retries are acknowledged without double-processing;
9. document provider privacy/retention and duplicate-person controls for the contracted flow;
10. only then enable policy allowlisting.

## Current production state

The P0.8 code integration can be deployed without Veriff credentials and will remain fail-closed. Until real credentials and canary evidence are supplied, Veriff must be described as **integrated / pending external certification**, not as an active KYC authority for governance.

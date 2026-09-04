# Identity Provider Production Onboarding — P0.7

## Purpose

P0.6 converted provider onboarding requirements into executable certification infrastructure without pretending that an uncontracted KYC vendor was supported. P0.7 closes the next application-owned gap: a real provider can now deliver its native webhook directly to VÉRTICE while the API preserves the exact raw bytes for cryptographic verification and retains auditable native provenance.

A provider is not production-ready merely because it has credentials, a webhook URL or an allowlist entry. Production onboarding requires cryptographic adapter certification, distributed replay protection, native webhook ingress, lifecycle canary evidence and a bounded production canary.

## Required sequence

A real provider integration must progress in this order:

1. Select and review the provider for the target jurisdiction and assurance policy.
2. Implement its native adapter using exact raw webhook bytes.
3. Verify the provider-native signature before parsing/normalizing authority-bearing fields.
4. Use `claimNativeProviderReplay` for distributed atomic replay claims backed by Redis.
5. Pass the P0.5 adversarial adapter certification with provider fixtures.
6. Pass the P0.6 lifecycle canary with distinct `verified`, `revoked` and `expired` events for one stable provider subject.
7. Register the native adapter in the compile-time provider registry.
8. Configure any provider credentials and the isolated internal adapter-to-VÉRTICE keyset required by the chosen deployment topology.
9. Deliver provider webhooks through `POST /identity/providers/:provider/webhook` when the adapter runs in-process, or through the signed normalized ingress when an external adapter service is used.
10. Add the provider to `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` only after steps 1–9 are evidenced.
11. Run a bounded production canary before relying on the provider for a new governance electorate.

## Distributed replay contract

`identity-provider-replay.ts` provides the production replay primitive.

The claim is stored with Redis `SET ... EX ... NX`, so only the first writer for a provider event succeeds during the replay window. The operational key contains a SHA-256 digest of `provider + event_id`; the raw vendor event id is not copied into Redis key names.

Redis failure is fail-closed. Identity proofing ingress must not continue if distributed replay protection cannot be established.

## Native webhook ingress contract — P0.7

`identity-provider-webhook.routes.ts` owns the provider-native HTTP boundary.

The route installs a Fastify content parser only inside `/identity/providers`, preserving the original request body as a `Buffer`. Normal API JSON parsing remains unchanged outside that encapsulated scope.

For a request to be accepted:

1. the provider must resolve to a compiled `NativeCivicIdentityProviderAdapter`;
2. the adapter must authenticate the exact raw payload using the vendor-native protocol;
3. freshness and replay protection must pass;
4. normalization must satisfy `CivicProofingEventSchema`;
5. normalized `provider` and `event_id` must remain bound to authenticated native metadata;
6. persistence records native provenance without storing the raw signature or vendor payload.

`civic_identity_proof_events.ingress_signature_version` now distinguishes:

- `0` — legacy P0.2 event;
- `1` — provider-isolated internal HMAC envelope;
- `2` — direct provider-native webhook authenticated by a compiled adapter.

For version `2`, `ingress_signed_at` stores the provider-authenticated timestamp while `ingress_key_id` remains null because vendor secret/key material is never copied into the event ledger.

Verified replay deliveries are not processed twice. The HTTP route acknowledges them as duplicates to avoid an infinite vendor retry loop while preserving the adapter's fail-closed replay semantics.

## Lifecycle canary contract

`certifyNativeProviderLifecycleCanary` requires three independently authenticated native deliveries:

- `verified` with assurance level at least 2;
- `revoked` for the same provider/citizen/provider_reference;
- `expired` for the same provider/citizen/provider_reference.

The canary also requires monotonic event time. A provider that changes subject binding across lifecycle events, downgrades verified assurance below the civic minimum, or emits a non-monotonic lifecycle does not pass onboarding.

## Operational readiness

A superadmin can inspect coarse provider readiness through:

`GET /identity/providers/readiness`

The endpoint exposes registered and activated provider identifiers and readiness booleans, but never provider secrets, raw webhook material or signatures.

## CI enforcement

The `Identity Provider Certification` workflow runs:

- shared type build;
- API typecheck;
- P0.5 cryptographic/adversarial adapter tests;
- P0.6 distributed replay and lifecycle canary tests;
- provider registry tests;
- P0.7 native ingress regression coverage when the identity provider boundary changes.

This gate runs both for pull requests and for pushes to `main` when the provider boundary changes.

## Current production state

The P0.7 native ingress boundary is implemented, but no real KYC provider is registered by this phase. `trusted_kyc` remains synthetic and production remains fail-closed.

The first vendor-specific integration must still supply the vendor's documented signature protocol, official/reproducible fixtures, sandbox credentials and webhook configuration. Those external artifacts are prerequisites for activating a production provider; they are not replaced by application configuration or synthetic tests.

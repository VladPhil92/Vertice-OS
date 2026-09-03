# Identity Provider Production Onboarding — P0.6

## Purpose

P0.6 converts the remaining provider onboarding requirements into executable infrastructure without selecting or pretending to support a KYC vendor that has not been contracted.

A provider is not production-ready merely because it has credentials, a webhook URL or an allowlist entry. Production onboarding requires cryptographic adapter certification, distributed replay protection and lifecycle canary evidence.

## Required sequence

A real provider integration must progress in this order:

1. Select and review the provider for the target jurisdiction and assurance policy.
2. Implement its native adapter using exact raw webhook bytes.
3. Verify the provider-native signature before parsing/normalizing authority-bearing fields.
4. Use `claimNativeProviderReplay` for distributed atomic replay claims backed by Redis.
5. Pass the P0.5 adversarial adapter certification with provider fixtures.
6. Pass the P0.6 lifecycle canary with distinct `verified`, `revoked` and `expired` events for one stable provider subject.
7. Register the native adapter in the compile-time provider registry.
8. Configure the isolated internal adapter-to-VÉRTICE keyset.
9. Add the provider to `CIVIC_IDENTITY_ASSURANCE_PROVIDERS` only after steps 1–8 are evidenced.
10. Run a bounded production canary before relying on the provider for a new governance electorate.

## Distributed replay contract

`identity-provider-replay.ts` provides the production replay primitive.

The claim is stored with Redis `SET ... EX ... NX`, so only the first writer for a provider event succeeds during the replay window. The operational key contains a SHA-256 digest of `provider + event_id`; the raw vendor event id is not copied into Redis key names.

Redis failure is fail-closed. Identity proofing ingress must not continue if distributed replay protection cannot be established.

## Lifecycle canary contract

`certifyNativeProviderLifecycleCanary` requires three independently authenticated native deliveries:

- `verified` with assurance level at least 2;
- `revoked` for the same provider/citizen/provider_reference;
- `expired` for the same provider/citizen/provider_reference.

The canary also requires monotonic event time. A provider that changes subject binding across lifecycle events, downgrades verified assurance below the civic minimum, or emits a non-monotonic lifecycle does not pass onboarding.

## CI enforcement

The `Identity Provider Certification` workflow runs:

- shared type build;
- API typecheck;
- P0.5 cryptographic/adversarial adapter tests;
- P0.6 distributed replay and lifecycle canary tests;
- provider registry tests.

This gate runs both for pull requests and for pushes to `main` when the provider boundary changes.

## Current production state

No real KYC provider is registered by P0.6. `trusted_kyc` remains synthetic and production remains fail-closed.

The next vendor-specific integration must supply the vendor's documented signature protocol, official/reproducible fixtures, sandbox credentials and webhook configuration. Those external artifacts are prerequisites for activating a production provider; they are not replaced by application configuration or synthetic tests.

# VÉRTICE OS — Market Release Certification

Snapshot: 22 September 2026.  
Evidence sync: **2026-09-22**.  
Current market-release status: **NOT CERTIFIED**.

## Purpose

This contract converts external/operator release work into a fail-closed evidence system. Repository source, CI and release gates can prove software properties, but they cannot honestly certify a physical device, a production payment/payout, a legal approval or a store review without external evidence.

The governing rule is simple:

> No evidence reference, no certification.

A successful pull-request run of `Market Release Certification Evidence` validates the structure and synchronization contracts only. It must never be interpreted as market certification. Only the manually invoked strict job against a completed evidence manifest may report the external/operator evidence bundle as complete, and existing exact-SHA CI/security/runtime gates must still be green.

## Release-candidate state synchronization

Before strict external evidence is considered, `scripts/verify-release-candidate-state.mjs` performs an internal RC pre-flight contract. It verifies that:

- `docs/CURRENT_STATE.md`, this certification contract and `MARKET_RELEASE_COMPLETION.md` carry the same evidence-sync marker;
- the product index includes the latest release-candidate hardening phase;
- critical external/operator work remains explicitly pending;
- the example market-release manifest remains fail-closed with the zero placeholder SHA and all evidence entries pending;
- the certification workflow executes both the evidence-schema verifier and the RC-state synchronization verifier;
- current documentation explicitly reports `NOT CERTIFIED` rather than converting source readiness into external certification.

This synchronization check proves **documentation/evidence integrity only**. It does not prove deployment, signing, physical-device behavior, provider operation, financial settlement, legal approval or store acceptance.

## Evidence manifest

Start from `release/evidence/market-release.example.json` and create a controlled manifest for the actual release candidate, normally `release/evidence/market-release.json`.

Every required evidence item has:

- `id`: stable machine-readable requirement;
- `status`: `pending`, `blocked`, `passed` or `approved`;
- `observed_at`: when the evidence was actually observed;
- `evidence_ref`: a durable reference to the evidence, not the evidence secret itself;
- `operator`: person/team that observed or approved it;
- `notes`: short non-sensitive context.

Do not put access tokens, API keys, passwords, bank credentials, identity documents, raw KYC payloads, private keys or other secrets/PII in the manifest. `evidence_ref` may point to a controlled artifact, ticket, provider receipt, store review, internal record or other durable evidence location.

The example manifest is deliberately non-certifying: its SHA is all zeroes and every required external item remains `pending`. Never convert the example into synthetic proof.

## Required certification domains

### Production runtime

- deployed Web/API SHA equals the release SHA;
- `/health/live` passes;
- `/health/ready` passes;
- `/health/release` passes;
- same-SHA runtime canary passes.

### Signed physical mobile

- Android signed physical smoke passes;
- iOS signed physical smoke passes;
- account deletion physical smoke passes, including inability to refresh/login afterward, cessation of push and provider avatar purge where applicable.

The physical smoke must exercise the release-representative paths that depend on hardware or OS integration: territory selection, GPS/maps, camera/gallery, media, push, deep links, Community, Workflows, Identity Assurance, Crowdfunding readiness and account deletion.

A production-like Expo export or simulator result is not signed physical-device evidence.

### External providers

- Veriff production decision/callback canary;
- Cloudflare Images upload/confirm/delivery canary;
- Cloudflare deletion purge canary;
- Mercado Pago bounded real-money canary including authenticated webhook, settlement and controlled refund;
- Wompi/BRE-B bounded real payout including provider and bank reconciliation.

Never certify a provider from configuration presence, feature flags, UI readiness or mocks alone.

### Resilience

- backup/restore drill passes against a release-compatible dataset/environment and leaves durable evidence.

### Legal and stores

- legal/commercial approval is recorded for Terms, Privacy/Habeas Data, retention, community/moderation, crowdfunding/refunds/fees, KYC/KYB, support/incident ownership and governance characterization;
- App Store production release is approved;
- Google Play production release is approved.

## Workflow

### Pull request / push validation

The workflow executes both internal fail-closed contracts:

```bash
node scripts/verify-market-release-evidence.mjs \
  --mode structure \
  --manifest release/evidence/market-release.example.json

node scripts/verify-release-candidate-state.mjs
```

The first command checks schema integrity, required IDs, controlled status values and obvious credential leakage. The second prevents release-state documentation and the placeholder manifest from drifting into false certification. Both are source-level checks and report `NOT CERTIFIED` by design.

### Strict certification

After the organization has collected real evidence, invoke `Market Release Certification Evidence` manually with:

- `release_sha`: exact 40-character release commit;
- `manifest_path`: completed controlled manifest.

The strict verifier fails if:

- the target SHA is malformed or absent;
- the manifest SHA differs from the requested release SHA;
- any mandatory item is absent or duplicated;
- any mandatory result is still pending/blocked;
- a required observation timestamp, evidence reference or operator is missing;
- obvious secret material appears in evidence metadata.

A strict evidence pass is necessary but not sufficient: the release SHA must also satisfy all applicable CI, SAST, Golden E2E, Golden Financial, Golden Governance, Production Hardening, runtime, mobile and privacy gates.

## Promotion states

Use these states consistently:

- `IMPLEMENTED`: source exists.
- `INTEGRATED`: source is connected to its internal dependencies.
- `DEPLOYED`: a runtime contains the source.
- `READY`: prerequisite checks for the specific capability pass.
- `CERTIFIED`: required external/operator evidence exists and the exact release SHA meets the applicable automated gates.

`RC PRE-FLIGHT` is an internal preparation state, not an additional certification level. It means the candidate can be assembled and audited without claiming the external evidence has occurred.

Never infer `CERTIFIED` from `IMPLEMENTED`, provider configuration, a passing source contract, an unsigned export, a simulator run or a browser-only callback.

## Release decision

VÉRTICE may be promoted as `CERTIFIED FOR MARKET RELEASE` only when both conditions are true:

1. the completed strict evidence manifest passes for the exact release SHA; and
2. all automated release/security/runtime gates required by `MARKET_RELEASE_COMPLETION.md` are green for that same release SHA.

Until then, report the precise blocking evidence IDs and the status **NOT CERTIFIED** rather than a generic percentage or an inferred release claim.

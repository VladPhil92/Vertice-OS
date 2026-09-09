# VÉRTICE OS — Market Release Certification

Snapshot: 9 September 2026.

## Purpose

This phase converts the remaining external/operator release work into a fail-closed evidence contract. Repository source, CI and release gates can prove software properties, but they cannot honestly certify a physical device, a production payment/payout, a legal approval or a store review without external evidence.

The governing rule is simple:

> No evidence reference, no certification.

A successful pull-request run of `Market Release Certification Evidence` validates the contract only. It must never be interpreted as market certification. Only the manually invoked strict job against a completed evidence manifest may report the external/operator evidence bundle as complete, and existing exact-SHA CI/security/runtime gates must still be green.

## Evidence manifest

Start from `release/evidence/market-release.example.json` and create a controlled manifest for the release candidate, normally `release/evidence/market-release.json`.

Every required evidence item has:

- `id`: stable machine-readable requirement;
- `status`: `pending`, `blocked`, `passed` or `approved`;
- `observed_at`: when the evidence was actually observed;
- `evidence_ref`: a durable reference to the evidence, not the evidence secret itself;
- `operator`: person/team that observed or approved it;
- `notes`: short non-sensitive context.

Do not put access tokens, API keys, passwords, bank credentials, identity documents, raw KYC payloads, private keys or other secrets/PII in the manifest. `evidence_ref` may point to a controlled artifact, ticket, provider receipt, store review, internal record or other durable evidence location.

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

The physical smoke should also exercise territory selection, GPS/maps, camera/gallery, media, push, deep links, Community, Workflows, Identity Assurance and Crowdfunding readiness on production-representative builds.

### External providers

- Veriff production decision/callback canary;
- Cloudflare Images upload/confirm/delivery canary;
- Cloudflare deletion purge canary;
- Mercado Pago bounded real-money canary including authenticated webhook, settlement and controlled refund;
- Wompi/BRE-B bounded real payout including provider and bank reconciliation.

Never certify a provider from configuration presence alone.

### Resilience

- backup/restore drill passes against a release-compatible dataset/environment.

### Legal and stores

- legal/commercial approval is recorded for Terms, Privacy/Habeas Data, retention, community/moderation, crowdfunding/refunds/fees, KYC/KYB, support/incident ownership and governance characterization;
- App Store production release is approved;
- Google Play production release is approved.

## Workflow

### Pull request / push validation

The workflow runs:

```bash
node scripts/verify-market-release-evidence.mjs \
  --mode structure \
  --manifest release/evidence/market-release.example.json
```

This checks schema integrity, required IDs, controlled status values and obvious credential leakage. It prints `NOT CERTIFIED` by design.

### Strict certification

After the organization has collected the real evidence, invoke `Market Release Certification Evidence` manually with:

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

Never infer `CERTIFIED` from `IMPLEMENTED`, provider configuration, a passing source contract, an unsigned simulator build or a browser-only callback.

## Release decision

VÉRTICE may be promoted as `CERTIFIED FOR MARKET RELEASE` only when both conditions are true:

1. the completed strict evidence manifest passes for the exact release SHA; and
2. all automated release/security/runtime gates required by `MARKET_RELEASE_COMPLETION.md` are green for that release.

Until then, report the precise blocking evidence IDs rather than a generic percentage.

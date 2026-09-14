# Phase — Release Candidate Hardening & Evidence Synchronization

Evidence sync: **2026-09-13**.

## Objective

Move VÉRTICE OS from domain-by-domain convergence into a disciplined release-candidate pre-flight without fabricating evidence that only an operator, physical device, external provider, bank, legal reviewer or app store can produce.

This phase does not add a new civic domain. It hardens the boundary between **software readiness** and **market certification**.

## Scope

The phase synchronizes five release-state authorities:

1. `docs/CURRENT_STATE.md` — what the product actually implements and what is still external.
2. `docs/engineering/MARKET_RELEASE_COMPLETION.md` — completion matrix split between repository-automatable and operator/external work.
3. `docs/engineering/MARKET_RELEASE_CERTIFICATION.md` — strict evidence semantics and promotion rule.
4. `release/evidence/market-release.example.json` — deliberately non-certifying placeholder manifest.
5. `docs/product/README.md` — chronological product/release phase index.

The new `scripts/verify-release-candidate-state.mjs` makes that synchronization executable and fail-closed.

## Release Candidate State Sync contract

The verifier requires the three mutable release-state documents (`CURRENT_STATE`, completion and certification) to carry the same machine-readable `Evidence sync` date. This phase document records when the contract was introduced; because it is a historical phase record, its marker is validated for format but is not required to move with future release snapshots. The verifier also checks that:

- the current-state document reports `NOT CERTIFIED`;
- the completion matrix preserves critical EAS/signing, physical-device, provider, resilience, legal and store items as unchecked;
- the market-release certification contract retains “No evidence reference, no certification” and the strict exact-SHA boundary;
- the product index references this phase;
- the example evidence manifest keeps the all-zero placeholder release SHA;
- every example evidence item remains `pending` with no observation timestamp, evidence reference or operator;
- the Market Release Certification workflow executes both the evidence schema verifier and the RC synchronization verifier.

A future real release manifest is intentionally outside this placeholder invariant: it must be created separately and validated in strict mode against the exact candidate SHA.

## Hardening decisions

### No arbitrary performance claim

This phase does not invent bundle-size, startup-time or rendering budgets without a reproducible baseline. Performance/accessibility work can continue automatically, but numeric release budgets should only be introduced after the metric collection path is deterministic and measured.

### No simulated external certification

Successful Expo exports, source tests, mocks, placeholder credentials or UI states do not count as:

- Android/iOS signed physical smoke;
- Veriff or Cloudflare production canary;
- Mercado Pago settlement/refund;
- Wompi/BRE-B payout/reconciliation;
- backup/restore drill;
- legal approval;
- App Store or Google Play approval.

### Financial boundary

The prior Financial & Crowdfunding Safety phase remains authoritative: Mobile may display server readiness and campaign state, but settlement, refund and payout authority remains server/provider-side. Money does not alter civic reputation, rank, vote or authority.

### Administrative and civic authority

The earlier territory, identity, community, governance and workflow boundaries remain unchanged. Release hardening must not convert UI state into identity assurance, residence assurance, governance eligibility, moderation guilt or administrative transition authority.

## Evidence produced by this phase

Repository evidence can prove:

- release documents are synchronized;
- critical external blockers remain explicit;
- the placeholder evidence manifest remains fail-closed;
- the PR SHA passes applicable CI/security/governance/source/export checks;
- review findings are resolved before merge.

It cannot prove any external event that has not occurred.

## Exit criteria

The phase is complete when:

- `Release Candidate State Sync` passes on the exact PR head;
- the existing market-release evidence structure contract passes;
- applicable required repository checks are green;
- all review threads are resolved;
- the branch is current with protected `main` before squash/rebase merge.

## Next boundary

After this phase, the remaining work splits into two tracks:

- **Repository-automatable:** reproducible performance/accessibility baselines, bundle budgets derived from measurements, verified dead-code removal, store metadata/privacy mapping and additional runbook/static hardening.
- **Operator/external:** EAS ownership/signing, Apple/Google accounts, physical-device smokes, provider canaries, real-money settlement/payout evidence, backup/restore drill, legal approval and store review.

VÉRTICE must remain **NOT CERTIFIED FOR MARKET RELEASE** until the exact release SHA satisfies both the automated gates and the strict external evidence contract.

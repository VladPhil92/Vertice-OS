# VÉRTICE OS — Android Public Release Certification, Phase 1

Date: 20 September 2026  
Frozen source SHA: `284ee6c1a0eba9a3695c34e50ddb19d5e91b0b35`  
Phase status: **REPOSITORY CONTRACT READY / NOT CERTIFIED FOR GOOGLE PLAY PRODUCTION**

## Purpose

This phase converts the existing release-candidate source into an auditable Android public-release package without pretending that external approvals or physical-device observations already occurred.

The frozen source SHA remains the application source under certification. Evidence and store manifests may live on a newer release-evidence branch, but they must point back to that exact source SHA.

## Material created in this phase

- `release/store/store-submission.json`: real candidate store package, distinct from the all-zero example template.
- `release/evidence/market-release.json`: real candidate evidence ledger, with external observations intentionally pending until they occur.
- `.github/workflows/android-public-release-certification.yml`: Phase 1 contract that validates the candidate package and proves strict certification remains fail-closed.

## What the gate certifies

The Phase 1 workflow verifies that:

1. both candidate manifests are structurally valid;
2. both manifests identify the same non-zero release SHA;
3. the frozen release SHA exists and is an ancestor of the evidence branch;
4. Android identity remains `com.ctgone.verticeos`;
5. EAS production remains store-distributed, AAB-based, commit-bound and auto-incremented;
6. the production API URL is HTTPS;
7. source routes for Privacy Policy and Account Deletion exist;
8. the Google Play icon and feature graphic exist;
9. strict store and market certification **do not pass** while approvals/evidence remain pending.

A green result therefore means **the repository-side Phase 1 release contract is ready**, not that the app is approved for production.

## Android blockers that remain outside repository-only proof

The next release boundary requires real operator/provider evidence:

- EAS/Android signing ownership confirmed for the production project;
- Google Play App Signing configured;
- production Google Maps Android key restricted to `com.ctgone.verticeos` and the real signing SHA-1;
- push credentials configured and verified;
- signed production-representative AAB generated;
- AAB uploaded to an Internal or Closed Testing track;
- phone screenshots captured from the real production-representative build;
- Google Play Data Safety, content rating, target audience and financial-features declarations completed accurately;
- reviewer access plan completed;
- physical Android smoke test completed against the exact promoted artifact;
- account deletion smoke completed;
- production `/health/live`, `/health/ready`, `/health/release` and same-SHA canary evidenced;
- legal/privacy/store metadata approvals recorded.

## Financial and identity capabilities

Mercado Pago, Wompi/BRE-B and Veriff must remain fail-closed unless their real production canaries are completed. Their source implementation or configuration presence is not certification.

A first public Android release may expose only capabilities whose current behavior and Play Console declarations accurately match the production state. No release document may represent real-money collection, payout or identity-provider certification as live merely because the code path exists.

## Promotion rule

Do not promote to Google Play production until the exact AAB/versionCode promoted through testing is the artifact that passed physical-device smoke and its evidence is attached to the candidate manifests. Any source or native-configuration change after artifact generation creates a new candidate and requires a new signed artifact/evidence cycle.

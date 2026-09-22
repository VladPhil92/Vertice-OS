# VÉRTICE OS — Market Release Completion Matrix

Snapshot: 22 September 2026.  
Evidence sync: **2026-09-22**.  
Current market-release status: **NOT CERTIFIED**.

This document separates work that can be completed and evidenced by repository automation from work that necessarily requires an operator, external account owner, provider, physical device or legal/commercial decision. A checked repository item is not a substitute for external observation.

## A. Repository-automatable completion

### A1. Product/domain code

- [x] Web/PWA civic command center.
- [x] REST API and canonical server authority.
- [x] Community/feed, social graph, civic ranking and Trust & Safety controls.
- [x] Civic actions and evidence.
- [x] Territorial reports/PostGIS/maps and national territory hierarchy.
- [x] Governance and reconstructible participation ledger.
- [x] Reputation separated from identity, popularity and money.
- [x] Workflows/civic cases with backend-authoritative transitions.
- [x] Civic Identity Assurance server boundary.
- [x] Crowdfunding lifecycle, fee policy, readiness and financial control plane.
- [x] National territorial architecture and account onboarding.
- [x] Native mobile civic core, device/media/map/push code.
- [x] Native Community/Feed/moderation parity.
- [x] Native Workflows/case-management parity.
- [x] Native Identity Assurance parity.
- [x] Native Crowdfunding campaign draft creation (same contract as web); collection (activation/contributions/checkout) shown with explicit launch-month copy.
- [x] Canonical Web/Mobile visual runtime for primary, trust, territory, community, workflow and financial secondary surfaces.
- [x] Account deletion API with irreversible identifier/credential erasure.
- [x] In-app mobile account deletion surface.
- [x] Authenticated web account deletion surface.
- [x] Public web account-deletion resource for store policy routing.
- [x] Durable auxiliary purge of avatar provider assets and derived graph identity.

### A2. Automated verification

- [x] General CI build/test/typecheck.
- [x] Semgrep Community SAST.
- [x] Golden E2E journeys.
- [x] Golden Main governance contract.
- [x] Golden Financial Integrity.
- [x] Production Hardening contract.
- [x] Frontend Runtime contract.
- [x] Railway Runtime contract.
- [x] National Platform Readiness.
- [x] National Citizen Activation.
- [x] National Account Onboarding.
- [x] Mobile Core Parity.
- [x] Mobile Device Release contract.
- [x] Mobile Domain Parity source/type/export gate.
- [x] Mobile production configuration fail-closed gate.
- [x] Mobile signing/provider credential repository boundary.
- [x] Account Deletion Privacy source/unit/type/export gate.
- [x] Cartagena same-SHA production canary infrastructure.
- [x] Market Release Certification evidence schema and fail-closed verifier.
- [x] Release Candidate State Sync contract for docs/index/example-manifest consistency.

These gates prove source/build/integration properties and, where a real runtime is queried, specific runtime properties. They cannot create or attest third-party credentials, bank settlement, legal approval, store approval or physical-device evidence. The Market Release Certification framework only makes those external requirements machine-verifiable **after real evidence exists**.

## B. Operator/external completion — mandatory human boundary

### B1. GitHub governance — COMPLETE

- [x] `Golden Main Protection` repository ruleset active.
- [x] Require pull request before merge.
- [x] Require conversation resolution.
- [x] Require stable CI/security/governance GitHub Actions checks.
- [x] Require branch to be up to date before merge.
- [x] Block force pushes and branch deletion.
- [x] Bypass actors = none.
- [x] Operational PR test confirmed both blocked and permitted merge states.

Repository governance is complete. This does not complete any external market-release domain below.

### B2. Mobile ownership and signing

Repository-side controls are implemented: canonical Expo/app identifiers, explicit preview/production profiles, fail-closed public release configuration, private-origin rejection, production-like CI introspection/export, signing-secret repository hygiene and generated binary exclusions.

External/account-owner boundary:

- [ ] Create/link the real EAS project and set its real `EAS_PROJECT_ID` in EAS environments.
- [ ] Configure real preview/production `EXPO_PUBLIC_API_URL` values in EAS.
- [ ] Own/configure Apple Developer account.
- [ ] Own/configure Google Play Console account.
- [ ] Provision Android signing identity / Play App Signing.
- [ ] Provision iOS distribution certificates/profiles.
- [ ] Provision the Android Google Maps key and restrict it to package `com.ctgone.verticeos` + real signing SHA-1.
- [ ] Configure APNs/FCM/EAS push credentials.
- [ ] Generate signed preview/production-representative Android and iOS builds.

Secrets and signing identities must never be committed to Git. See `docs/engineering/MOBILE_PRODUCTION_RELEASE.md`.

### B3. Physical-device certification

On at least one production-representative Android device and one iOS device:

- [ ] install signed preview/release build;
- [ ] signup/login/refresh/logout and CTG One federation where applicable;
- [ ] national territory selection and residence-assurance navigation;
- [ ] GPS permission and location accuracy;
- [ ] map rendering;
- [ ] camera/gallery selection;
- [ ] media upload/confirmation;
- [ ] push opt-in and device registration;
- [ ] foreground/background push delivery;
- [ ] deep-link routing;
- [ ] Community follow/unfollow/feed/block/report;
- [ ] Workflows/case detail and traceability;
- [ ] Identity Assurance/provider handoff;
- [ ] Crowdfunding campaign draft creation and collection pre-launch copy;
- [ ] account deletion from the in-app profile surface;
- [ ] confirm the deleted identity cannot refresh/login and no longer receives push;
- [ ] confirm avatar/provider cleanup completes when an avatar existed.

Source export success is not physical-device certification.

### B4. External provider certification

#### Veriff

- [ ] production account/contract;
- [ ] `VERIFF_BASE_URL`, API key and shared secret provisioned server-side;
- [ ] callback/webhook configured;
- [ ] real decision lifecycle received and authenticated;
- [ ] evidence-backed external canary promoted current.

#### Cloudflare Images

- [ ] production credentials;
- [ ] upload/confirm canary from physical device;
- [ ] delivery URL verified;
- [ ] account-deletion avatar purge canary verified.

#### Mercado Pago

- [ ] production merchant account/credentials;
- [ ] bounded real checkout;
- [ ] authenticated webhook/provider refetch;
- [ ] settlement verified;
- [ ] controlled refund verified;
- [ ] bank reconciliation evidence retained.

#### Wompi / BRE-B

- [ ] Pagos a Terceros production access;
- [ ] source account and operator controls;
- [ ] webhook/signing configuration;
- [ ] beneficiary resolution/confirmation canary;
- [ ] bounded real payout;
- [ ] provider reconciliation and bank evidence retained.

Financial source readiness, feature flags and CI do not certify real settlement or payout.

### B5. Resilience

- [ ] Execute a documented backup/restore drill against a release-compatible dataset/environment.
- [ ] Retain durable evidence of restore result, operator and observation time.

### B6. Legal/commercial approval

Repository drafts/checklists can be automated, but the organization must approve:

- [ ] Terms of Service;
- [ ] Privacy Policy and Colombian data-processing/Habeas Data obligations;
- [ ] Account-deletion retention categories and legally required retention periods;
- [ ] Community Guidelines and moderation policy;
- [ ] Crowdfunding terms, commissions and refund disclosures;
- [ ] KYC/KYB and payout disclosures;
- [ ] support/contact and incident-response ownership;
- [ ] legal characterization of civic/consultative governance surfaces.

### B7. Stores

- [ ] App Store Connect listing/privacy labels/screenshots/content declarations;
- [ ] Confirm the App Store reviewer can locate in-app account deletion;
- [ ] TestFlight release and review notes;
- [ ] Apple production submission/review;
- [ ] Google Play Data Safety/content rating/store listing;
- [ ] Register the public `/account-deletion` resource in Play Console where requested;
- [ ] closed/open testing as required;
- [ ] Google Play production submission/review.

The external/operator results above must be recorded through the controlled evidence manifest described in `MARKET_RELEASE_CERTIFICATION.md`. A pending or blocked item must remain pending/blocked; source code, UI text, configuration presence or a source-only CI pass cannot substitute for observation.

## C. Release-candidate pre-flight rule

The repository may be described as **RC-preflight capable** when its internal source/security/integration gates pass for the candidate SHA and `Release Candidate State Sync` confirms that release documentation and the example evidence manifest remain fail-closed.

That state is intentionally weaker than `CERTIFIED FOR MARKET RELEASE`. It does not assert that the candidate is deployed, signed, tested on hardware, financially settled, legally approved or accepted by stores.

The current example manifest must remain a placeholder (`release_sha = 000…000`) with every external item `pending`; real completion belongs only in a controlled candidate manifest backed by evidence.

## D. Final certification rule

VÉRTICE may be described as `CERTIFIED FOR MARKET RELEASE` only when the exact release SHA satisfies all repository gates that apply **and** all mandatory external/operator evidence has been completed and validated in strict mode.

The final bundle must include, at minimum:

```text
CI                                  PASS
SAST                                PASS
Golden E2E                          PASS
Golden Financial Integrity          PASS
Golden Governance                   PASS
Production Hardening                PASS
Account Deletion Privacy            PASS
Release Candidate State Sync        PASS
Web/API production SHA              MATCH
/health/live                        PASS
/health/ready                       PASS
/health/release                     PASS
Same-SHA runtime canary             PASS
Android signed physical smoke       PASS
IOS signed physical smoke           PASS
Account deletion physical smoke     PASS
Veriff external canary              PASS
Cloudflare Images canary            PASS
Cloudflare deletion purge canary    PASS
Mercado Pago bounded canary         PASS
Wompi/BRE-B bounded payout canary   PASS
Backup/restore drill                PASS
Legal approval                      APPROVED
App Store release                   APPROVED
Google Play release                 APPROVED
```

The strict Market Release Certification evidence gate remains a companion to, not a replacement for, existing automated CI/security/runtime gates.

Until then, use evidence-specific states (`IMPLEMENTED`, `INTEGRATED`, `DEPLOYED`, `READY`, `CERTIFIED`) and explicit blockers rather than a generic “100%”.

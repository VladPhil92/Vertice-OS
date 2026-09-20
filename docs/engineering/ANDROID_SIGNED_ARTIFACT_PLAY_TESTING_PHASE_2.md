# VÉRTICE OS — Android Signed Artifact & Google Play Testing, Phase 2

Execution target: September 2026.
Phase purpose: turn the repository-ready Android release candidate into a real signed AAB and place that exact artifact in Google Play Internal testing, without exposing it publicly.

## Release source rule

For the automated execution triggered by the merge of this phase, the exact GitHub main commit that receives release/android/phase2-signed-artifact.json is the release source.

The workflow checks out github.sha explicitly. EAS therefore receives a clean committed source tree, and the evidence artifact records:

- release Git SHA;
- EAS build ID and canonical build metadata;
- the signed .aab;
- SHA-256 of that exact AAB;
- EAS submission log/list metadata.

A later source/native-config change requires a new build and a new evidence cycle.

## Build configuration

Canonical Android identity remains:

- package: com.ctgone.verticeos;
- EAS project: 4ee77781-adec-42f6-be19-64a68848f4c7;
- build profile: production;
- EAS environment: production;
- artifact: Android App Bundle (.aab);
- remote version source with automatic native build-version increment.

EAS CLI is pinned by the execution request and CI to 24.7.0.

## Credential boundary

No credential is stored in Git.

The real execution requires:

1. GitHub Actions secret EXPO_TOKEN, containing an Expo personal access token with access to the ctg-one-technology project.
2. EAS Android production signing credentials already provisioned. CI uses --freeze-credentials, so it will not silently create or mutate signing identity.
3. EAS production environment variable GOOGLE_MAPS_ANDROID_API_KEY, restricted in Google Cloud to package com.ctgone.verticeos and the real signing/Play certificate SHA-1.
4. Google Play application for com.ctgone.verticeos.
5. Google Service Account key uploaded to EAS Android service credentials with sufficient Google Play permissions.

If any boundary is missing, the workflow must fail and identify that boundary instead of downgrading to a placeholder.

## Google Play destination

Phase 2 configures:

- track: internal;
- release status: completed.

This makes the build available only to configured internal testers. It does not publish VÉRTICE to the general public.

## Why Internal testing first

The objective is to make the Play-distributed binary itself the object under test. Local APKs, Expo Go, simulator exports, and unsigned bundles are not substitutes.

After successful submission:

1. configure or confirm the internal tester list in Play Console;
2. install from the Google Play tester link;
3. perform the exact-artifact physical smoke suite;
4. capture version/build ID and device evidence;
5. promote the evidence ledger only after observation.

## Required Android physical smoke after this phase

At minimum:

- clean installation from Google Play;
- launch and first-run stability;
- signup/login/logout/session refresh;
- CTG One federation;
- national territory selection;
- GPS permission and map rendering;
- camera/gallery and real media upload;
- Community Guidelines acceptance;
- feed/follow/block/report;
- push opt-in, foreground delivery, background/closed-app delivery and notification deep link;
- Workflows/case navigation;
- Identity Assurance behavior in its current certified/fail-closed state;
- crowdfunding behavior matching the declared prelaunch/payment state;
- in-app account deletion;
- failed refresh/re-login after deletion according to deletion contract;
- push cessation and avatar/provider cleanup.

## Promotion rule

A green Phase 2 workflow proves SIGNED BUILD + GOOGLE PLAY INTERNAL SUBMISSION only.

It does not prove physical smoke, closed-testing requirements, legal approval, Data Safety approval, production access or public release. Those remain separate evidence domains.

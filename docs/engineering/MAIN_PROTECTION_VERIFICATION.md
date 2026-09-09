# VÉRTICE OS — Main Protection Verification

Snapshot: 9 September 2026.

## Active repository ruleset

- Ruleset: `Golden Main Protection`
- Enforcement: `active`
- Scope: default branch (`main`)
- Bypass actors: none
- Pull request required before merge
- Required approving reviews: 0
- Review conversations must be resolved
- Allowed merge methods: squash, rebase
- Required status checks must pass against an up-to-date branch
- Branch deletion blocked
- Non-fast-forward / force-push blocked

## Required GitHub Actions checks

1. `Tests`
2. `Calidad de Código`
3. `Security Scan`
4. `Golden Browser Journeys`
5. `Golden API Journeys`
6. `Golden Main Governance Contract`
7. `Semgrep CE`

## Operational verification

This document is introduced through a dedicated pull request whose purpose is to validate the ruleset itself. The verification sequence is:

1. confirm the PR cannot merge while required checks are pending or failing;
2. confirm an unresolved review conversation blocks merge;
3. resolve that conversation;
4. confirm the PR becomes mergeable only after all required checks pass and the branch is current with `main`;
5. merge through an allowed method;
6. close governance issue #128 only after the above behavior is observed.

The repository ruleset, not this document, is the enforcement authority.

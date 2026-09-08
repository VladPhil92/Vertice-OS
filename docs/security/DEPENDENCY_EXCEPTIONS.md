# Dependency Security Exceptions

> Last reviewed: 7 September 2026

This file records **narrow, temporary exceptions** to the repository dependency-audit gate. An exception is not a claim that the underlying issue is harmless. It documents why the repository cannot consume a patched upstream version yet, how exposure is constrained, and the condition that removes the exception.

## Active exceptions

### `GHSA-w3rx-r6r6-pgpr` — `image-size` ICNS parser denial of service

- Severity: High.
- Affected package: `image-size <= 2.0.2`.
- Current path in this repository: Expo/Metro build tooling under `apps/mobile`.
- Upstream patched version: none published at review time.
- Runtime exposure in VÉRTICE: the vulnerable package is reached through the React Native Metro/build toolchain; it is not used by the VÉRTICE API to parse citizen-uploaded images in production.
- Mitigation: keep the exception limited to this GHSA; do not disable the `high` audit gate globally; keep Expo/Metro dependencies current and avoid processing untrusted ICNS input in CI/build jobs.
- Removal condition: remove this exception immediately when Expo/Metro resolves to a non-vulnerable `image-size` release or upstream publishes a patched version compatible with the mobile toolchain.

### `GHSA-5p2g-fcmc-qvqq` — `image-size` JXL/HEIF parser denial of service

- Severity: High.
- Affected package: `image-size <= 2.0.2`.
- Current path in this repository: Expo/Metro build tooling under `apps/mobile`.
- Upstream patched version: none published at review time.
- Runtime exposure in VÉRTICE: same build-toolchain boundary described above; no API endpoint intentionally delegates untrusted citizen media parsing to this package.
- Mitigation: exact-GHSA exception only, continued high-severity auditing for every other package, and dependency review on Expo/Metro updates.
- Removal condition: remove this exception as soon as a compatible patched dependency path exists.

## Governance rule

Every future audit exception must include the advisory identifier, severity, dependency path, runtime exposure, mitigation, owner/review date and a concrete removal condition. Broad flags such as `--ignore-unfixable` should not replace a named exception unless a release incident explicitly requires it and the decision is documented.

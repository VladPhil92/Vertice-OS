# VÉRTICE OS — Technology Refresh Audit

**Audit date:** 7 September 2026  
**Scope:** monorepo, CI/CD, web runtime, API/auth boundary, Kubernetes hygiene, documentation and native mobile readiness.

## Executive result

The repository already contained a broad civic operating system, but the audit found a release-blocking CI regression, a security-patch gap in Next.js, drift between runtime documentation and package manifests, dual lockfile ownership, tracked secret-shaped Kubernetes configuration and no native mobile workspace.

This refresh converts those findings into concrete repository changes instead of treating them as roadmap-only items.

## Findings and remediations

| Priority | Finding | Resolution in this refresh |
|---|---|---|
| P0 | `main` contained a parser regression in `privilege-provenance-hardening.test.ts`, blocking unit tests and downstream build | Repaired the duplicated test declaration and preserved the authorization hardening assertions |
| P0 | Web was pinned to Next.js 15.5.23 while the current maintenance security patch is 15.5.24 | Upgraded Next.js and `eslint-config-next` to 15.5.24; retained React 18 to minimize major-upgrade blast radius |
| P0 | New mobile dependencies initially desynchronized `pnpm-lock.yaml` from package manifests | Added deterministic lockfile synchronization and regenerated the root lockfile with pnpm 10.34.5 |
| P1 | Monorepo runtime baseline allowed Node 20 while the native Expo 57 baseline requires Node 22.13+ | Root engine is now Node >=22.13 and pnpm >=10 |
| P1 | No native app existed; only a PWA/service worker surface existed under web | Added `apps/mobile` with Expo SDK 57, React Native 0.86.3, React 19.2.3 and Expo Router |
| P1 | Browser authentication relies on httpOnly refresh cookies + browser storage, which is not a safe native contract | Added `/auth/mobile/token`, `/auth/mobile/refresh` and `/auth/mobile/logout`; native refresh tokens are stored via OS-backed SecureStore |
| P1 | Kubernetes tracked `secrets.yaml` directly, even though values were placeholders | Replaced it with `secrets.example.yaml`, removed it from Kustomize resources and ignored local `secrets.yaml` |
| P1 | `contracts/package-lock.json` coexisted with the root pnpm workspace lock | Removed the duplicate npm lockfile; pnpm is the monorepo package-manager authority |
| P2 | Next.js exposed its framework response header and image negotiation was not explicitly modernized | Disabled `X-Powered-By`, enabled strict mode explicitly and prefers AVIF/WebP through `next/image` |
| P2 | README/current-state descriptions lagged package/runtime changes | Refreshes documentation around Node 22, Next 15.5.24, native mobile and operator-owned release steps |

## Native architecture introduced

```text
apps/mobile (Expo / React Native)
        │
        │ HTTPS + Bearer access token
        ▼
/auth/mobile/* ───────┐
                      │ same session service
/auth/* (web) ────────┤
                      ▼
                 apps/api
              Fastify + JWT
             Prisma sessions
```

The native client does not copy browser cookies or localStorage. It stores credentials through `expo-secure-store`, uses the same durable server session records as web, rotates short-lived access tokens through the native refresh endpoint and revokes the backend session on logout.

The first native product slice exposes:

- sign-in/session bootstrap;
- citizen command center;
- reputation summary;
- pending-attention summary;
- civic-action/report/proposal/legal/workflow metrics;
- profile and secure logout;
- pull-to-refresh;
- EAS build profiles.

## Web optimization decisions

This refresh deliberately chooses a **minimal security-compatible Next.js patch** rather than immediately moving the production web app to Next.js 16. The repository contains large, security-sensitive civic and identity surfaces, so a major framework migration should be a separately measurable change with browser regression coverage.

The next web performance tranche should focus on route-level code splitting and component decomposition in the largest dashboard/legal/community/identity surfaces, asset-size budgets and real Web Vitals from production telemetry. Framework-level package import optimization is not forced here because Next.js already optimizes common libraries such as `lucide-react`, `date-fns` and `recharts` by default.

## Repository debt still visible

The refresh does not label the platform “100% complete”. Remaining engineering debt includes:

- oversized route/components that should be decomposed behind stable API contracts;
- legacy source trees that should be removed only after confirming no operational/documentation dependency remains;
- large static visual assets that need an explicit asset budget and compression pipeline;
- provider integrations that remain fail-closed until credentials and external canaries succeed;
- production deployment/store certification that cannot be proven from source code alone.

## Operator-owned actions

These actions require external authority/credentials and therefore are intentionally not automated by source changes:

1. Protect `main` with required checks and review rules. The audit observed no active branch protection.
2. Provision `vertice-secrets` from a real secret manager/Kubernetes secret process before applying the Kustomize base.
3. Certify Railway/Vercel production readiness after merge and verify `/health` + `/health/ready`.
4. Configure an Expo/EAS project and Apple/Google signing identities.
5. Supply App Store / Play Store privacy disclosures, screenshots, content rating and reviewer credentials.
6. Run identity-provider and other external integration canaries with real provider credentials before promoting those capabilities.

## Release rule

A repository commit is **not** equivalent to a production release. A technology refresh is considered releasable only when its latest commit has passed the required CI contracts, the production deployment reaches readiness, and external-provider capabilities that are being advertised have passed their own certification gates.

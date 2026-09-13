# Phase — Workflow & Case Management Convergence

## Objective

Converge the native workflow and civic-case experience on the canonical VÉRTICE product language while preserving a strict authority boundary: the client may display persisted administrative state, evidence and requirements, but it may not invent, infer or execute a legal/administrative transition unless an explicit backend contract authorizes it.

This tranche follows Community Trust & Moderation Convergence. The workflow list and case detail still used the retired beige/green visual layer and represented case progression with local glyphs. That made a trust-sensitive administrative surface look disconnected from the rest of the application and risked conflating a visual step with an authoritative state change.

## Runtime delivered

### Workflow case list

`apps/mobile/app/workflows/index.tsx` now uses the canonical design-token adapter, bundled Montserrat/Inter aliases, VÉRTICE brand assets and the semantic icon adapter.

Each case exposes the backend-provided stage, report status and persisted analysis/proposal/control artifacts. Progress indicators are descriptive only. The existing `/workflows/cases?limit=50` read contract and navigation to the case detail are unchanged.

The screen states the authority boundary in-product: the backend retains authority over administrative state and the native client does not create, advance or resolve stages by rendering them.

### Workflow case detail

`apps/mobile/app/workflows/[id].tsx` now separates five concepts that were previously compressed into one basic timeline:

1. current server stage;
2. temporal traceability for report creation, case creation and last recorded update;
3. persisted workflow artifacts for report, analysis, proposal and control;
4. proposal/control metadata already returned by the API;
5. the next visible signal, described as informational rather than executable authority.

The existing `GET /workflows/cases/:id` contract remains the source of truth. The case detail does not introduce `POST`, mutation, analyze, proposal or control transition calls.

### Persisted artifacts, not invented history

The UI does not manufacture administrative events that are absent from the response. It renders only timestamps and artifacts already present in `CivicCase`: report creation, case creation/update, analysis audit ID, proposal metadata and control metadata.

The product rule is explicit: a missing artifact means only that the server response does not expose that persisted artifact; it does not mean the client is authorized to create it.

## Icon boundary extension

`apps/mobile/components/VerticeIcon.tsx` now exposes semantic aliases for this tranche:

- `workflow`
- `case`
- `history`
- `document`
- `pending`
- `required`

Lucide ownership remains centralized in the adapter. Workflow screens do not import icon families directly and no Unicode glyph is used as a primary state icon.

## Regression gate

`apps/mobile/scripts/verify-workflow-case-surfaces.mjs` certifies both workflow surfaces. It fails if a migrated screen:

- loses the canonical theme, brand or semantic icon adapters;
- imports Lucide directly;
- reintroduces local hexadecimal colors or raw font families;
- restores Unicode glyphs as state icons;
- removes the existing case-list/read/detail/report-navigation contracts;
- removes the explicit backend-authority boundary;
- removes persisted-artifact or traceability copy;
- introduces `apiMutation`, `POST`, `/analyze`, `/proposal` or `/control` transition tokens into this read-only convergence tranche.

The gate is chained into Mobile Core Parity through `verify-font-alias-contract.mjs`.

## Authority boundary

This phase changes presentation, accessibility and case-state comprehension only. It does not change:

- workflow state-machine rules;
- analysis creation authority;
- proposal creation or voting authority;
- control/legal workflow authority;
- report state semantics;
- identity or residence assurance;
- governance eligibility or voter rolls;
- moderation disposition;
- payments, donations or crowdfunding authorization.

The backend remains the system of record for administrative state transitions.

## Next tranche

After this phase, the next high-risk domain is Financial & Crowdfunding Safety. It should be treated as a separate tranche because contribution collection, payout readiness, campaign activation, reconciliation and monetary failure states require stronger authorization, compliance and idempotency review than ordinary visual convergence.

## Release certification

This phase is certified only when the exact PR head passes the applicable repository gates, including Mobile Core Parity, native typecheck, Android/iOS export assertions, Mobile Domain Parity, Golden API/Browser journeys, security scans and repository CI. Source integration does not constitute App Store/Play Store publication or physical-device validation.

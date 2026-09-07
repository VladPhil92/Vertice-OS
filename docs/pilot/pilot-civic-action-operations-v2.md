# Pilot Civic Action Operations v2

## Objective

Align the Pilot Control Center with the current VÉRTICE product model, where **Acción Cívica** is the primary unit of social/community management and the pilot north-star is evidence-backed execution rather than vote volume or social popularity.

This phase extends the existing privacy-safe control plane; it does not replace reports/proposals and it does not modify the reputation formula.

## Control Center contract

- API: `GET /dashboard/admin/pilot`
- Web: `/dashboard/admin/pilot`
- Roles: `admin`, `superadmin`
- Window: 7 days for new activity counters
- Current lifecycle counters: aggregate across non-deleted persisted Civic Actions
- No citizen UUID, evidence URL, document hash, DID, wallet, email or IP is exposed

## Meaningful participation v2

The unique-participant aggregate now recognizes first-class Civic Action behavior in addition to the existing report/proposal/profile signals. A citizen is included when they perform at least one attributable activity in the seven-day window, including:

- create a Civic Action;
- submit Civic Action evidence;
- join an action as a collaborator;
- corroborate/dispute a Civic Action;
- create a territorial report;
- create or endorse a proposal;
- validate civic-profile activity;
- follow a public civic profile.

Anonymous votes remain excluded from identity attribution.

## Civic Action outcome telemetry

### Seven-day flow

- Civic Actions created;
- evidence entries submitted;
- Civic Action validations updated.

### Lifecycle inventory

- `proposed`;
- `preparing`;
- `in_progress`;
- `result_declared`;
- `under_verification`;
- `verified`;
- `disputed`;
- `no_evidence`;
- `not_completed`;
- total non-cancelled actions.

### Evidence and verification health

The dashboard derives:

- actions with at least one evidence entry;
- evidence coverage rate = actions with evidence / non-cancelled actions;
- verified-action rate = verified actions / non-cancelled actions;
- seven-day Civic Action corroborations and disputes.

These are operational ratios. They are not reputation scores and do not grant permissions.

## Pilot operating interpretation

The Control Center should now answer, without exposing participant-level data:

1. Are citizens progressing from account activation into attributable civic work?
2. Are Civic Actions moving from declaration into preparation/execution?
3. Are declared results reaching moderation and verification?
4. What fraction of the action portfolio has traceable evidence?
5. Are `disputed`, `no_evidence` or `not_completed` states accumulating?
6. Is moderator capacity proportionate to the operational queue?

## Reputation and electoral boundaries

This phase preserves the existing invariants:

- social popularity does not affect reputation;
- community corroboration is a bounded/operational signal and does not become a permission primitive;
- the Pilot Control Center is not an electoral-results console;
- anonymous votes are never reverse-attributed for analytics;
- verified Civic Action state remains controlled by moderator/admin review, never self-issued by an action owner.

## Acceptance criteria

- Civic Action authors/evidence collaborators/validators participate in the aggregate meaningful-participant count without exposing identities.
- Control Center API returns Civic Action lifecycle, evidence and verification aggregates.
- UI exposes a dedicated Civic Action outcomes section and preserves the legacy operational section.
- Empty cohorts return stable zero rates.
- Existing score-policy flags remain `false` for social-popularity and community-validation effects.
- CI/unit tests certify the new response shape.

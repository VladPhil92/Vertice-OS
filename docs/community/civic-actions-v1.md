# Civic Actions & Reputation v1

## Product contract

VÉRTICE treats an **Acción Cívica** as the primary unit of social/community management. A generic post can communicate activity, but it is not itself evidence of impact.

An action captures:

- a concrete problem;
- a verifiable objective;
- territory and category;
- a responsible civic actor;
- expected beneficiaries and target date when available;
- lifecycle state;
- evidence ledger;
- community corroborations/disputes;
- an explainable civic score;
- a separate confidence score.

Reports and proposals remain supported. Civic Actions are the forward-looking domain model for work that must be managed from declaration through evidence and verification.

## Lifecycle

Owner-controlled transitions:

```text
proposed → preparing → in_progress → result_declared
                    ↘ not_completed
                    ↘ cancelled
```

When a result is declared, moderation owns verification transitions:

```text
result_declared → under_verification → verified
                ↘ disputed
                ↘ no_evidence
```

A disputed/no-evidence/not-completed action can be reopened by its owner into execution. An owner cannot set `verified` directly.

## Evidence ledger

`civic_action_evidence` is append-oriented from the product surface and supports:

- photo;
- video;
- document;
- location;
- external record.

A client may provide a SHA-256 hash. When present it is globally unique across the ledger, preventing the same binary evidence from being recycled across actions.

Evidence review states are `pending`, `accepted`, `disputed`, and `rejected`. A moderator verification decision promotes pending evidence to accepted.

### Evidence levels

The API exposes a derived evidence level:

- **L0** — declaration only;
- **L1** — evidence attached;
- **L2** — positive corroboration from verified community identities;
- **L3** — externally referenced evidence under moderator review or verified;
- **L4** — moderator-verified action with high confidence.

Uploads alone never manufacture L3/L4.

## VÉRTICE Civic Reputation v1

The score is deterministic, bounded to 0–100, versioned as `civic-reputation-v1`, and returned together with the contribution of every dimension.

| Dimension | Maximum |
|---|---:|
| Evidence | 25 |
| Results | 20 |
| Community impact | 15 |
| Fulfillment | 15 |
| Citizen validation | 10 |
| Continuity | 5 |
| Transparency | 5 |
| Collaboration | 5 |
| **Total** | **100** |

Followers, likes, impressions and raw popularity are deliberately excluded.

### Community validation

Only verified identities can write a validation through the API. The database allows a single current stance per citizen/action. The service rejects self-validation. Corroborations contribute at most ten score points, while disputes reduce that contribution and lower confidence.

This is a bounded signal, not a plebiscite and not an electoral vote.

## Confidence is not reputation

`confidence_score` is returned separately from `civic_score`. It reflects the amount and traceability of supporting evidence, external references, hashes, moderation state and the balance of verified community validation. It never increases the 100-point reputation total.

The UI exposes both values so a high score with weak evidence is visibly different from a high score backed by strong evidence.

## Territorial leaderboards

The Civic Actions leaderboard aggregates only public civic profiles and uses:

- average action score: 75%;
- average confidence: 15%;
- verified-action rate: 10%.

Follower count, likes and impressions are excluded.

## Security / anti-gaming controls in v1

Implemented:

- verified identity required to create actions, attach evidence or validate;
- owner cannot self-validate;
- one current validation per citizen/action;
- owner cannot self-promote to verified;
- live moderator/admin role required for verification decisions;
- global SHA-256 evidence de-duplication when hash is supplied;
- review history is durable and auditable;
- cancelled actions leave public ranking;
- private civic profiles do not enter the public action feed or leaderboard.

Next anti-gaming layer should add relationship-graph analysis for coordinated corroboration, circular validation, device/account farms and near-duplicate evidence when clients cannot provide hashes.

## API

Prefix: `/civic-actions`

- `GET /` — public civic action feed;
- `GET /mine` — authenticated actor portfolio;
- `POST /` — create action (verified identity);
- `GET /:actionId` — authenticated detail with visibility policy;
- `PATCH /:actionId` — owner update / owner-controlled lifecycle;
- `GET|POST /:actionId/evidence` — evidence ledger;
- `GET /:actionId/validations` — validation summary;
- `PUT|DELETE /:actionId/validation` — verified citizen stance;
- `POST /:actionId/review` — moderator review;
- `GET /leaderboard` — territorial reputation leaderboard.

## Pilot rollout

For the Cartagena pilot, the first operational success criterion is no longer vote volume. The north-star event is an **evidence-backed civic action**: an action that progresses beyond declaration and accumulates traceable evidence.

Recommended pilot measurements:

- actions created / started / result-declared / verified;
- median time between lifecycle states;
- evidence coverage per action;
- corroboration/dispute rate;
- confidence distribution;
- verified-action rate by territory;
- active civic leaders and organizations;
- repeated participation without popularity-driven ranking.

# Social Graph & Evidence v2

## Purpose

This phase turns the VÉRTICE civic feed into a real social graph without turning popularity into reputation.

## Product invariants

1. Following a profile is a discovery/subscription action only.
2. Follower counts, likes, impressions and community corroborations do **not** increase `civic-action-v1` or leaderboard score.
3. Civic profile identity remains separate from authorization roles.
4. Only voluntarily published civic profiles can be followed or ranked.
5. Making a civic profile private removes inbound follow relationships.
6. A citizen cannot follow their own profile.
7. A citizen cannot corroborate or dispute their own activity.
8. Disputes require an explanation.
9. Community corroboration is not equivalent to an institutionally verified result.
10. Validation writes are idempotent per citizen/activity through a composite primary key.

## New persistence

### `civic_profile_follows`

Stores `follower_id -> followed_id` with a self-follow constraint and indexes for follower/followed timelines.

### `civic_activity_validations`

Stores one stance per citizen per civic activity:

- `corroborate`
- `dispute`

The activity reference is polymorphic (`report` or `proposal`). The API verifies that the source object exists before accepting a validation.

## API surface

- `GET /community/following/feed`
- `GET /community/profiles/:citizenId`
- `GET /community/profiles/:citizenId/follow-state`
- `POST /community/profiles/:citizenId/follow`
- `DELETE /community/profiles/:citizenId/follow`
- `GET /community/activities/:type/:activityId/validations`
- `PUT /community/activities/:type/:activityId/validation`
- `DELETE /community/activities/:type/:activityId/validation`

## Ranking policy

The VÉRTICE leaderboard continues to use evidence, results, verified execution and evidence coverage. Social graph metrics and community validation counts are deliberately excluded from ranking inputs in this phase.

## Next candidate phase

After pilot evidence is collected, a future trust-model phase may evaluate weighted corroboration using verified identity, territorial proximity, conflicts of interest and moderator resolution. That must be separately versioned and must not silently modify `civic-action-v1`.
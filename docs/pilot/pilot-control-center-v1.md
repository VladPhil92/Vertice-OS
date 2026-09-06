# Pilot Control Center v1

## Objective

Provide administrators with an operational, privacy-safe view of a controlled VÉRTICE pilot without exposing participant-level personal data or weakening the platform's anonymous voting model.

## Access

- API: `GET /dashboard/admin/pilot`
- Web: `/dashboard/admin/pilot`
- Roles: `admin`, `superadmin`
- Authorization is checked against the live role grant, not only the role embedded in the JWT.

## Seven-day pilot metrics

### Cohort

- active citizens
- registrations
- weekly active citizens
- verified identities
- CTG One/external federated identities
- voluntarily public civic profiles
- verification, federation, weekly-active and meaningful-participation rates

### Meaningful participation

A citizen is counted once when, during the seven-day window, they perform at least one attributable civic action:

- create a territorial report;
- create a proposal;
- endorse a proposal;
- corroborate/dispute civic evidence;
- follow a public civic profile.

Votes are deliberately excluded from participant attribution because VÉRTICE voting uses anonymous nullifiers. The dashboard must not reverse-map anonymous votes to citizens merely to improve analytics.

### Operations

- open, in-progress and resolved reports;
- proposals in debate and voting;
- evidence corroborations and disputes;
- active privileged operators.

## Privacy contract

The endpoint does not return emails, DIDs, wallet addresses, identity-document hashes, IP addresses or citizen UUIDs.

Territorial cohort rows are suppressed when fewer than three active citizens share the same neighborhood value. This is a minimum aggregation rule for the pilot dashboard, not a substitute for a complete privacy impact assessment.

## Reputation boundary

Followers, follows, impressions, likes, corroborations and disputes remain operational/community signals. They do **not** modify `civic-action-v1` or the VÉRTICE reputation score.

## Pilot interpretation

The Control Center is intended to answer operational questions such as:

- Are invited/registered citizens becoming verified and active?
- Are citizens performing meaningful civic actions rather than merely creating accounts?
- Is moderation workload accumulating?
- Are evidence disputes increasing?
- Is participation geographically distributed enough to justify expanding the cohort?

It is not an electoral results console and does not identify how any citizen voted.

# P0 — Privilege Provenance Hardening

## Security invariant

`citizens.role` is a compatibility projection, not an authorization source. An elevated VÉRTICE role (`moderator`, `admin`, `superadmin`) is effective only while a live `citizen_role_grants` row exists with trusted provenance.

Trusted elevated provenance is limited to:

- `ctg_one_bootstrap`: only for the canonical CTG One root identity pinned by `ROOT_AUTHORITY_PINNING.md`.
- `superadmin_dashboard`: only when `granted_by_citizen_id` has a live superadmin lineage that ultimately terminates in that canonical root bootstrap.

The historical sources `legacy_role` and `legacy_backfill` may not create, revive, or preserve elevated authority.

## Session behavior

Local login always starts at the `citizen` baseline. Refresh keeps an elevated `active_role` only if the live-role lookup still finds the corresponding active grant. Federated login activates an elevated role directly only when the same exchange successfully confirms the canonical CTG One root bootstrap; otherwise it starts at `citizen`.

## Database enforcement

Migration `20260907210000_privilege_provenance_hardening` performs an authority handover before cleanup so it remains compatible with the pre-existing `LAST_SUPERADMIN_PROTECTED` invariant:

1. resolves the canonical CTG One root using the pinned email + subject digest;
2. under the superadmin advisory lock, establishes/rewrites the root's `moderator`, `admin`, and `superadmin` grants as `ctg_one_bootstrap` without ever removing the final active superadmin;
3. revokes remaining elevated grants from `legacy_role` and `legacy_backfill`;
4. aborts if unknown or non-root-backed elevated provenance remains active;
5. downgrades stale privileged sessions to `citizen`;
6. recalculates `citizens.role` from live grants as a compatibility projection;
7. installs `citizen_role_grants_privilege_provenance`, rejecting future elevated grants unless provenance is canonical bootstrap or an authorized root-backed superadmin dashboard action.

If the canonical root cannot be proven at migration time, deployment fails closed with `CANONICAL_ROOT_REQUIRED_FOR_PRIVILEGE_HANDOVER`; the last-superadmin guard is never disabled.

## Operational consequence

Operators who previously depended only on legacy elevated roles lose that authority by design. The canonical root remains continuously authorized through the atomic provenance handover and can explicitly re-grant required roles from Control VÉRTICE. This converts historical implicit authority into auditable explicit authority without creating a superadmin-free interval.

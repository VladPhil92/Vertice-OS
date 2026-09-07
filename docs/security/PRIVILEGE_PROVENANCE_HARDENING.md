# P0 — Privilege Provenance Hardening

## Security invariant

`citizens.role` is a compatibility projection, not an authorization source. An elevated VÉRTICE role (`moderator`, `admin`, `superadmin`) is effective only while a live `citizen_role_grants` row exists with trusted provenance.

Trusted elevated provenance is limited to:

- `ctg_one_bootstrap`: only for the canonical CTG One root identity pinned by `ROOT_AUTHORITY_PINNING.md`.
- `superadmin_dashboard`: only when `granted_by_citizen_id` currently holds a trusted live `superadmin` grant.

The historical sources `legacy_role` and `legacy_backfill` may not create, revive, or preserve elevated authority.

## Session behavior

Local login always starts at the `citizen` baseline. Refresh keeps an elevated `active_role` only if the live-role lookup still finds the corresponding active grant. Federated login activates an elevated role directly only when the same exchange successfully confirms the canonical CTG One root bootstrap; otherwise it starts at `citizen`.

## Database enforcement

Migration `20260907210000_privilege_provenance_hardening`:

1. revokes active elevated grants from `legacy_role` and `legacy_backfill`;
2. aborts deployment if any other unknown elevated provenance remains active;
3. downgrades stale privileged sessions to `citizen`;
4. recalculates `citizens.role` from live grants as a compatibility projection;
5. installs `citizen_role_grants_privilege_provenance`, rejecting future elevated grants unless provenance is canonical bootstrap or an authorized superadmin dashboard action.

## Operational consequence

Any operator who previously depended only on a legacy elevated role loses that authority by design. A current trusted superadmin must explicitly re-grant the required role from Control VÉRTICE. This converts historical implicit authority into auditable explicit authority.

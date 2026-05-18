// Selector hook: every admin-adjacent capability the signed-in user
// holds, computed against the realm's group-setting permissions and
// per-group membership.
//
// `RequireAdminAccess` and the four admin pages (organization, users,
// groups, invites) gate visibility and per-row actions on this hook
// rather than on the raw `is_admin` flag — because Zulip lets regular
// members hold real admin-shaped powers (create their own bots,
// administer groups they were appointed to manage, send invites).
// Mirroring the server's permission model in the UI lets a department
// lead in `can_manage_group` actually see the management surface they
// were granted, instead of being silently redirected to `/`.
//
// Source data:
//   - `is_admin` / `is_owner` come from `usersStore` (resolved by
//     `authStore.session.userId`). These are the only powers
//     unconditionally above per-group / per-setting permissions.
//   - The five `realm_can_*_group` group-setting values come from
//     `realmStore`; membership is resolved against `userGroupsStore`
//     by the shared `isUserInGroupSetting` walker.
//   - Per-group `can_manage_group` / `can_add_members_group` /
//     `can_remove_members_group` are scanned across the whole group
//     directory to derive the set of groups the user can manage at
//     all. The store is small (low-hundreds of groups in even the
//     largest realms) so a full pass per render is cheap, and
//     `useMemo` keys it on the directory reference.
//
// The hook is intentionally a pure read — no realtime wiring of its
// own. Each source store publishes on changes, so the consumer
// re-renders whenever the session, the realm settings, the user
// directory, or the group directory updates.

import { useMemo } from "react";

import type { UserGroup } from "../../domain";
import { isUserInGroupSetting } from "../groupMembership";
import { useAuthStore } from "../../stores/authStore";
import { useRealmStore } from "../../stores/realmStore";
import type { UserGroupDirectory } from "../../stores/userGroupsReducer";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useUsersStore } from "../../stores/usersStore";

/**
 * Capabilities the signed-in user holds for the admin surfaces. Every
 * boolean mirrors a server-side gate; the `*GroupIds` sets cover
 * per-group powers that produce a list rather than a single boolean.
 */
export interface AdminCapabilities {
  /** `is_admin || is_owner` — overrides every per-setting check below. */
  isRealmAdmin: boolean;
  /**
   * Convenience alias for `isRealmAdmin`. Org-settings page edits
   * have no group-setting gate today, so this collapses to the same
   * value — the alias exists so call sites read by intent rather
   * than by role.
   */
  canManageOrg: boolean;
  /** Member of `realm_can_invite_users_group`. */
  canInviteUsers: boolean;
  /** Member of `realm_can_create_bots_group`. */
  canCreateBots: boolean;
  /**
   * Member of `realm_can_create_write_only_bots_group`. Distinct from
   * `canCreateBots`: write-only grants only the incoming-webhook
   * bot type, not generic / outgoing.
   */
  canCreateWriteOnlyBots: boolean;
  /** Member of `realm_can_create_groups`. */
  canCreateGroups: boolean;
  /** Member of `realm_can_manage_all_groups` — implicit admin on every group. */
  canManageAllGroups: boolean;
  /** Groups where the user directly has `can_manage_group`. */
  managedGroupIds: ReadonlySet<number>;
  /**
   * Groups where the user has any membership-mutation power:
   * `can_manage_group` ∪ `can_add_members_group` ∪
   * `can_remove_members_group`. The /admin/groups list filters
   * against this so a department lead with only `add_members`
   * still sees their group.
   */
  manageableGroupIds: ReadonlySet<number>;
  /**
   * `true` if any admin tab should be visible to this user. Drives
   * the `/admin/*` route gate and the navbar "Administration"
   * dropdown entry.
   */
  hasAnyAdminAccess: boolean;
}

const EMPTY_SET: ReadonlySet<number> = new Set();

const EMPTY_CAPABILITIES: AdminCapabilities = {
  isRealmAdmin: false,
  canManageOrg: false,
  canInviteUsers: false,
  canCreateBots: false,
  canCreateWriteOnlyBots: false,
  canCreateGroups: false,
  canManageAllGroups: false,
  managedGroupIds: EMPTY_SET,
  manageableGroupIds: EMPTY_SET,
  hasAnyAdminAccess: false,
};

/**
 * Scan the group directory for groups the user can mutate at all.
 * Returns two sets: `managed` (full `can_manage_group`) and
 * `manageable` (any of manage / add-members / remove-members — the
 * superset used to decide "should this group show up in the admin
 * list").
 */
function deriveManageableGroups(
  directory: UserGroupDirectory,
  userId: number,
): { managed: Set<number>; manageable: Set<number> } {
  const managed = new Set<number>();
  const manageable = new Set<number>();
  for (const group of Object.values(directory) as UserGroup[]) {
    if (group.deactivated) {
      continue;
    }
    const isManager = isUserInGroupSetting(
      group.can_manage_group,
      userId,
      directory,
    );
    const isAdder = isUserInGroupSetting(
      group.can_add_members_group,
      userId,
      directory,
    );
    const isRemover = isUserInGroupSetting(
      group.can_remove_members_group,
      userId,
      directory,
    );
    if (isManager) {
      managed.add(group.id);
    }
    if (isManager || isAdder || isRemover) {
      manageable.add(group.id);
    }
  }
  return { managed, manageable };
}

export function useAdminCapabilities(): AdminCapabilities {
  const userId = useAuthStore((s) => s.session?.userId);
  const user = useUsersStore((s) =>
    userId !== undefined ? s.users[userId] : undefined,
  );
  const realm = useRealmStore((s) => s.realm);
  const userGroups = useUserGroupsStore((s) => s.userGroups);

  return useMemo(() => {
    if (userId === undefined) {
      return EMPTY_CAPABILITIES;
    }

    const isRealmAdmin = user?.is_admin === true || user?.is_owner === true;

    // Realm-level can_*_group checks: when a setting is absent from
    // the snapshot (older server, or `fetch_event_types` did not
    // request `realm`), treat as "no permission" — never grant by
    // default. Admin override is applied separately so an admin
    // still flows through every gate.
    const canInviteUsers =
      isRealmAdmin ||
      isUserInGroupSetting(
        realm?.realm_can_invite_users_group,
        userId,
        userGroups,
      );
    const canCreateBots =
      isRealmAdmin ||
      isUserInGroupSetting(
        realm?.realm_can_create_bots_group,
        userId,
        userGroups,
      );
    const canCreateWriteOnlyBots =
      isRealmAdmin ||
      canCreateBots ||
      isUserInGroupSetting(
        realm?.realm_can_create_write_only_bots_group,
        userId,
        userGroups,
      );
    const canCreateGroups =
      isRealmAdmin ||
      isUserInGroupSetting(
        realm?.realm_can_create_groups,
        userId,
        userGroups,
      );
    const canManageAllGroups =
      isRealmAdmin ||
      isUserInGroupSetting(
        realm?.realm_can_manage_all_groups,
        userId,
        userGroups,
      );

    const { managed, manageable } = deriveManageableGroups(userGroups, userId);

    const hasAnyAdminAccess =
      isRealmAdmin ||
      canInviteUsers ||
      canCreateBots ||
      canCreateWriteOnlyBots ||
      canCreateGroups ||
      canManageAllGroups ||
      manageable.size > 0;

    return {
      isRealmAdmin,
      canManageOrg: isRealmAdmin,
      canInviteUsers,
      canCreateBots,
      canCreateWriteOnlyBots,
      canCreateGroups,
      canManageAllGroups,
      managedGroupIds: managed,
      manageableGroupIds: manageable,
      hasAnyAdminAccess,
    };
  }, [userId, user?.is_admin, user?.is_owner, realm, userGroups]);
}

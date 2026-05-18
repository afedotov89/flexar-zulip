// Selector hook: per-group permissions for the signed-in viewer.
//
// Sibling to `useAdminCapabilities`, scoped to one specific user
// group. The four bool fields mirror the Zulip per-group settings
// that the admin UI cares about:
//
//   - `canManage`: hold `can_manage_group` on this group → rename,
//     edit description, edit permission settings, deactivate. Realm
//     admins and `can_manage_all_groups` members always pass.
//   - `canAddMembers`: hold `can_add_members_group` → add members /
//     subgroups (Zulip uses the same setting for both per its
//     model). Manage implies this.
//   - `canRemoveMembers`: hold `can_remove_members_group`. Manage
//     implies this.
//   - `canSeeDetail`: any of the above OR the viewer is a direct
//     member. Drives the "should I render the detail page at all,
//     or fall back to a read-only banner" decision in the parent.
//
// Returning a single bundle keeps each gated tab from re-firing the
// `useAdminCapabilities` selector and re-walking the group graph.

import { useMemo } from "react";

import type { UserGroup } from "../../domain";
import { isUserInGroupSetting } from "../groupMembership";
import { useAuthStore } from "../../stores/authStore";
import { useUserGroupsStore } from "../../stores/userGroupsStore";
import { useAdminCapabilities } from "./useAdminCapabilities";

export interface GroupCapabilities {
  canManage: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canSeeDetail: boolean;
}

const EMPTY: GroupCapabilities = {
  canManage: false,
  canAddMembers: false,
  canRemoveMembers: false,
  canSeeDetail: false,
};

export function useGroupCapabilities(
  group: UserGroup | undefined,
): GroupCapabilities {
  const viewerUserId = useAuthStore((s) => s.session?.userId);
  const directory = useUserGroupsStore((s) => s.userGroups);
  const realmCaps = useAdminCapabilities();

  return useMemo<GroupCapabilities>(() => {
    if (group === undefined || viewerUserId === undefined) {
      return EMPTY;
    }
    // System groups are not editable from this UI even for realm
    // admins (the API allows it but Zulip's model is that system
    // groups represent the role roster and shouldn't be renamed
    // here). Match the existing read-only banner.
    if (group.is_system_group) {
      return {
        canManage: false,
        canAddMembers: false,
        canRemoveMembers: false,
        canSeeDetail: true,
      };
    }
    const adminOverride =
      realmCaps.isRealmAdmin || realmCaps.canManageAllGroups;

    const canManage =
      adminOverride ||
      isUserInGroupSetting(group.can_manage_group, viewerUserId, directory);
    const canAddMembers =
      canManage ||
      isUserInGroupSetting(
        group.can_add_members_group,
        viewerUserId,
        directory,
      );
    const canRemoveMembers =
      canManage ||
      isUserInGroupSetting(
        group.can_remove_members_group,
        viewerUserId,
        directory,
      );
    const isMember = group.members.includes(viewerUserId);
    const canSeeDetail =
      canManage || canAddMembers || canRemoveMembers || isMember;
    return { canManage, canAddMembers, canRemoveMembers, canSeeDetail };
  }, [
    group,
    viewerUserId,
    directory,
    realmCaps.isRealmAdmin,
    realmCaps.canManageAllGroups,
  ]);
}

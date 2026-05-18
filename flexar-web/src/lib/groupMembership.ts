// Resolving Zulip "group-setting values" against the user-group
// directory.
//
// Many Zulip permissions are stored as a `GroupSettingValue`: either a
// single user-group id (the common case for system groups like
// `role:members`) or an anonymous bundle of direct users + subgroups.
// The realm-level admin permissions (who may create bots, invite
// users, manage groups) and every per-group `can_*_group` setting use
// this same shape.
//
// `isUserInGroupSetting` answers the only question the UI cares about:
// is the signed-in user covered by this permission? It walks the
// group graph transitively (subgroup → subgroup) so a user counts as
// included if any reachable group has them as a direct member, or
// they appear in the anonymous form's `direct_members`.
//
// Cycle protection: a `visited` set bounds the traversal even if the
// directory ever serves a malformed cycle (which the server isn't
// supposed to do, but we don't want a runtime stack overflow if it
// does).

import type { GroupSettingValue, UserGroup, UserId } from "../domain";
import type { UserGroupDirectory } from "../stores/userGroupsReducer";

/**
 * Walk a group's transitive membership (direct members + members of
 * every reachable subgroup) and return `true` once `userId` is found.
 */
function isUserInGroupTransitive(
  groupId: number,
  userId: UserId,
  directory: UserGroupDirectory,
  visited: Set<number>,
): boolean {
  if (visited.has(groupId)) {
    return false;
  }
  visited.add(groupId);

  const group: UserGroup | undefined = directory[groupId];
  if (group === undefined) {
    return false;
  }
  if (group.members.includes(userId)) {
    return true;
  }
  for (const subgroupId of group.direct_subgroup_ids) {
    if (isUserInGroupTransitive(subgroupId, userId, directory, visited)) {
      return true;
    }
  }
  return false;
}

/**
 * Is `userId` covered by the permission described by `setting`?
 *
 * - `number` form: a single group id; the user counts if transitively
 *   a member.
 * - Object form: the user counts if listed in `direct_members`, or if
 *   transitively a member of any group in `direct_subgroups`.
 */
export function isUserInGroupSetting(
  setting: GroupSettingValue | undefined,
  userId: UserId | undefined,
  directory: UserGroupDirectory,
): boolean {
  if (setting === undefined || userId === undefined) {
    return false;
  }
  const visited = new Set<number>();
  if (typeof setting === "number") {
    return isUserInGroupTransitive(setting, userId, directory, visited);
  }
  if (setting.direct_members.includes(userId)) {
    return true;
  }
  for (const subgroupId of setting.direct_subgroups) {
    if (isUserInGroupTransitive(subgroupId, userId, directory, visited)) {
      return true;
    }
  }
  return false;
}

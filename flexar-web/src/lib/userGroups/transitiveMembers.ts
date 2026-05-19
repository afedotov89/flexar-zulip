// Pure helper: compute every user that is a member of a user group,
// directly OR transitively through its subgroup graph.
//
// The wire `members` field on a `UserGroup` is direct-only — system
// groups model their role hierarchy through `direct_subgroup_ids`
// (e.g. `role:administrators.direct_subgroup_ids = [role:owners.id]`),
// and custom groups can nest the same way. Showing a "members count"
// that only looks at `direct_members` misleads admins; this helper
// walks the subgroup graph so the UI can show the full count that
// matches what permissions actually grant.
//
// DFS with a visited set — cycle-safe even though the server rejects
// cycles, so a malformed snapshot can't hang the page.
//
// Pure function, no React, no stores. Inputs passed explicitly.

import type { UserGroup, UserId } from "../../domain";

/**
 * All members of `groupId`, transitively through `direct_subgroup_ids`.
 * Returns an empty set when the id isn't in the directory.
 */
export function computeTransitiveMembers(
  groupId: number,
  directory: Readonly<Record<number, UserGroup>>,
): Set<UserId> {
  const members = new Set<UserId>();
  const visited = new Set<number>();
  const stack: number[] = [groupId];
  while (stack.length > 0) {
    const currentId = stack.pop() as number;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    const group = directory[currentId];
    if (group === undefined) {
      continue;
    }
    for (const memberId of group.members) {
      members.add(memberId);
    }
    for (const subId of group.direct_subgroup_ids) {
      if (!visited.has(subId)) {
        stack.push(subId);
      }
    }
  }
  return members;
}

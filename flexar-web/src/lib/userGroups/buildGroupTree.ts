// Pure helper: build a forest of `TreeNode`s from a flat list of
// `UserGroup`s using their `direct_subgroup_ids` edges.
//
// Used by the admin groups page to render system roles as a real tree
// — Zulip's role hierarchy
// (`internet ⊃ everyone ⊃ members ⊃ fullmembers ⊃ moderators ⊃
// administrators ⊃ owners`) plus an orphan `nobody`. The flat list
// hides this structure; the tree section makes it visible at a glance.
//
// Roots are groups in the input not referenced as a `direct_subgroup_id`
// by any other group in the input. Cycle-safe via a visited set —
// the server rejects cycles, but a malformed snapshot can't hang the
// page. The output preserves the input's order: roots sorted by the
// caller, children in `direct_subgroup_ids` order.
//
// Pure function, no React, no stores.

import type { UserGroup } from "../../domain";

export interface TreeNode {
  group: UserGroup;
  /** 0 for roots; +1 per level of nesting. */
  depth: number;
  children: TreeNode[];
}

export function buildGroupTree(
  groups: ReadonlyArray<UserGroup>,
): TreeNode[] {
  if (groups.length === 0) {
    return [];
  }
  const byId = new Map<number, UserGroup>();
  for (const g of groups) {
    byId.set(g.id, g);
  }

  // A group is a root iff no other group's `direct_subgroup_ids`
  // points at it. Compute the set of all referenced ids first.
  const referenced = new Set<number>();
  for (const g of groups) {
    for (const subId of g.direct_subgroup_ids) {
      if (byId.has(subId)) {
        referenced.add(subId);
      }
    }
  }

  function walk(id: number, depth: number, visited: Set<number>): TreeNode | null {
    if (visited.has(id)) {
      return null;
    }
    const group = byId.get(id);
    if (group === undefined) {
      return null;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(id);
    const children: TreeNode[] = [];
    for (const subId of group.direct_subgroup_ids) {
      const child = walk(subId, depth + 1, nextVisited);
      if (child !== null) {
        children.push(child);
      }
    }
    return { group, depth, children };
  }

  const roots: TreeNode[] = [];
  for (const g of groups) {
    if (!referenced.has(g.id)) {
      const node = walk(g.id, 0, new Set());
      if (node !== null) {
        roots.push(node);
      }
    }
  }
  return roots;
}

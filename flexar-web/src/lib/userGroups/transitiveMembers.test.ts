import { describe, expect, it } from "vitest";
import type { UserGroup } from "../../domain";
import { computeTransitiveMembers } from "./transitiveMembers";

function makeGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    name: `group-${overrides.id}`,
    description: "",
    is_system_group: false,
    members: [],
    direct_subgroup_ids: [],
    creator_id: null,
    date_created: null,
    deactivated: false,
    can_add_members_group: 1,
    can_join_group: 1,
    can_leave_group: 1,
    can_manage_group: 1,
    can_mention_group: 1,
    can_remove_members_group: 1,
    ...overrides,
  };
}

function directory(...groups: UserGroup[]): Record<number, UserGroup> {
  return Object.fromEntries(groups.map((g) => [g.id, g]));
}

describe("computeTransitiveMembers", () => {
  it("returns an empty set when the id is unknown", () => {
    expect(computeTransitiveMembers(999, directory()).size).toBe(0);
  });

  it("returns direct members when the group has no subgroups", () => {
    const dir = directory(makeGroup({ id: 1, members: [10, 20] }));
    expect([...computeTransitiveMembers(1, dir)].sort()).toEqual([10, 20]);
  });

  it("includes members of direct subgroups", () => {
    const dir = directory(
      makeGroup({ id: 1, direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, members: [30] }),
    );
    expect([...computeTransitiveMembers(1, dir)]).toEqual([30]);
  });

  it("walks deeply nested subgroup chains (A → B → C)", () => {
    // Mirrors Zulip's role hierarchy: administrators → owners.
    const dir = directory(
      makeGroup({ id: 1, direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, direct_subgroup_ids: [3] }),
      makeGroup({ id: 3, members: [42] }),
    );
    expect([...computeTransitiveMembers(1, dir)]).toEqual([42]);
  });

  it("merges direct members with members reached via subgroups", () => {
    const dir = directory(
      makeGroup({ id: 1, members: [10], direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, members: [20] }),
    );
    expect([...computeTransitiveMembers(1, dir)].sort()).toEqual([10, 20]);
  });

  it("deduplicates members reachable through multiple paths", () => {
    // 1 has two subgroups (2 and 3), both contain user 42.
    const dir = directory(
      makeGroup({ id: 1, direct_subgroup_ids: [2, 3] }),
      makeGroup({ id: 2, members: [42] }),
      makeGroup({ id: 3, members: [42, 99] }),
    );
    expect([...computeTransitiveMembers(1, dir)].sort()).toEqual([42, 99]);
  });

  it("is cycle-safe (A → B → A)", () => {
    const dir = directory(
      makeGroup({ id: 1, direct_subgroup_ids: [2], members: [10] }),
      makeGroup({ id: 2, direct_subgroup_ids: [1], members: [20] }),
    );
    expect([...computeTransitiveMembers(1, dir)].sort()).toEqual([10, 20]);
  });

  it("tolerates a subgroup id missing from the directory", () => {
    const dir = directory(
      makeGroup({ id: 1, members: [10], direct_subgroup_ids: [999] }),
    );
    expect([...computeTransitiveMembers(1, dir)]).toEqual([10]);
  });
});

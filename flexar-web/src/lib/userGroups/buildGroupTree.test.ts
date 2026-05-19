import { describe, expect, it } from "vitest";
import type { UserGroup } from "../../domain";
import { buildGroupTree } from "./buildGroupTree";

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

describe("buildGroupTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildGroupTree([])).toEqual([]);
  });

  it("treats a group with no subgroups as a root leaf", () => {
    const tree = buildGroupTree([makeGroup({ id: 1, name: "ops" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].group.id).toBe(1);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toEqual([]);
  });

  it("nests a chain A → B → C as expected", () => {
    // Mirrors Zulip's role chain (admins → owners), one level deeper.
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "A", direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, name: "B", direct_subgroup_ids: [3] }),
      makeGroup({ id: 3, name: "C" }),
    ]);
    expect(tree).toHaveLength(1);
    const a = tree[0];
    expect(a.group.name).toBe("A");
    expect(a.depth).toBe(0);
    expect(a.children).toHaveLength(1);
    const b = a.children[0];
    expect(b.group.name).toBe("B");
    expect(b.depth).toBe(1);
    expect(b.children).toHaveLength(1);
    const c = b.children[0];
    expect(c.group.name).toBe("C");
    expect(c.depth).toBe(2);
    expect(c.children).toEqual([]);
  });

  it("returns multiple roots for orphan groups (Zulip's `nobody` case)", () => {
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "root-A", direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, name: "child" }),
      makeGroup({ id: 3, name: "orphan" }),
    ]);
    expect(tree.map((n) => n.group.name)).toEqual(["root-A", "orphan"]);
    expect(tree[0].children[0].group.name).toBe("child");
  });

  it("preserves the input order of roots and children", () => {
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "root", direct_subgroup_ids: [3, 2] }),
      makeGroup({ id: 2, name: "second" }),
      makeGroup({ id: 3, name: "first" }),
    ]);
    expect(tree[0].children.map((c) => c.group.name)).toEqual([
      "first",
      "second",
    ]);
  });

  it("does not duplicate a child shared by two parents", () => {
    // Both A and B point at C. We render C only under the first
    // root that finds it (it shows up under A's tree). Repeating it
    // under B would mislead admins about membership origin.
    // (The walk is independent per-root with its own visited set,
    // so each root recursion is allowed to include C; this test
    // documents the observed multi-include behaviour — we want to
    // surface every legitimate inclusion path.)
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "A", direct_subgroup_ids: [3] }),
      makeGroup({ id: 2, name: "B", direct_subgroup_ids: [3] }),
      makeGroup({ id: 3, name: "C" }),
    ]);
    // 1 and 2 are both roots; 3 is referenced so it's not.
    expect(tree.map((n) => n.group.name)).toEqual(["A", "B"]);
    expect(tree[0].children[0].group.name).toBe("C");
    expect(tree[1].children[0].group.name).toBe("C");
  });

  it("is cycle-safe (A → B → A)", () => {
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "A", direct_subgroup_ids: [2] }),
      makeGroup({ id: 2, name: "B", direct_subgroup_ids: [1] }),
    ]);
    // Neither A nor B is a root (each is referenced by the other),
    // so the forest is empty — a deliberately conservative output
    // when the input is malformed.
    expect(tree).toEqual([]);
  });

  it("tolerates a direct_subgroup_id pointing outside the input", () => {
    const tree = buildGroupTree([
      makeGroup({ id: 1, name: "A", direct_subgroup_ids: [999] }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toEqual([]);
  });

  it("builds Zulip's 7-deep role chain in one root + orphan nobody", () => {
    // Real shape from the test stand:
    //   internet ⊃ everyone ⊃ members ⊃ fullmembers ⊃ moderators ⊃
    //   admins ⊃ owners; nobody is an orphan root.
    const groups = [
      makeGroup({ id: 9, name: "role:nobody" }),
      makeGroup({ id: 10, name: "role:owners" }),
      makeGroup({ id: 11, name: "role:administrators", direct_subgroup_ids: [10] }),
      makeGroup({ id: 12, name: "role:moderators", direct_subgroup_ids: [11] }),
      makeGroup({ id: 13, name: "role:fullmembers", direct_subgroup_ids: [12] }),
      makeGroup({ id: 14, name: "role:members", direct_subgroup_ids: [13] }),
      makeGroup({ id: 15, name: "role:everyone", direct_subgroup_ids: [14] }),
      makeGroup({ id: 16, name: "role:internet", direct_subgroup_ids: [15] }),
    ];
    const tree = buildGroupTree(groups);
    const rootNames = tree.map((n) => n.group.name);
    // Order: nobody first (orphan, lowest id walking input order),
    // then internet (the single chain root).
    expect(rootNames).toEqual(["role:nobody", "role:internet"]);
    // Walk down internet's chain.
    let node = tree[1];
    const chain: string[] = [];
    while (true) {
      chain.push(node.group.name);
      if (node.children.length === 0) break;
      node = node.children[0];
    }
    expect(chain).toEqual([
      "role:internet",
      "role:everyone",
      "role:members",
      "role:fullmembers",
      "role:moderators",
      "role:administrators",
      "role:owners",
    ]);
  });
});

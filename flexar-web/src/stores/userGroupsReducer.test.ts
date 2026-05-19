// Unit tests for the user-groups reducers (`src/stores/userGroupsReducer`).
//
// Covers hydration from `realm_user_groups` and each `user_group`
// event op (add / remove / update / add_members / remove_members /
// add_subgroups / remove_subgroups), including the edge cases the
// reducer must tolerate: events for unknown group ids, deduplication
// when merging members/subgroups, and non-mutation of input state.

import { describe, expect, it } from "vitest";
import type { UserGroup, UserGroupEvent } from "../domain";
import { makeInitialState } from "./testFixtures";
import {
  applyUserGroupEvent,
  userGroupsFromInitialState,
} from "./userGroupsReducer";

function makeUserGroup(overrides: Partial<UserGroup> & { id: number }): UserGroup {
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

describe("userGroupsFromInitialState", () => {
  it("indexes realm_user_groups by id", () => {
    const directory = userGroupsFromInitialState(
      makeInitialState({
        realm_user_groups: [
          makeUserGroup({ id: 1, name: "alpha" }),
          makeUserGroup({ id: 2, name: "beta" }),
        ],
      }),
    );
    expect(Object.keys(directory)).toEqual(["1", "2"]);
    expect(directory[1].name).toBe("alpha");
    expect(directory[2].name).toBe("beta");
  });

  it("returns an empty directory when realm_user_groups is absent", () => {
    expect(userGroupsFromInitialState(makeInitialState())).toEqual({});
  });

  it("returns an empty directory when realm_user_groups is empty", () => {
    expect(
      userGroupsFromInitialState(
        makeInitialState({ realm_user_groups: [] }),
      ),
    ).toEqual({});
  });
});

describe("applyUserGroupEvent — add", () => {
  it("inserts a new group", () => {
    const event: UserGroupEvent = {
      id: 1,
      type: "user_group",
      op: "add",
      group: makeUserGroup({ id: 7, name: "qa" }),
      for_reactivation: false,
    };
    const next = applyUserGroupEvent({}, event);
    expect(next[7].name).toBe("qa");
  });

  it("overwrites an existing entry on reactivation", () => {
    const directory = {
      7: makeUserGroup({ id: 7, name: "qa", deactivated: true }),
    };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add",
      group: makeUserGroup({ id: 7, name: "qa", deactivated: false }),
      for_reactivation: true,
    });
    expect(next[7].deactivated).toBe(false);
  });
});

describe("applyUserGroupEvent — remove", () => {
  it("drops the group from the directory", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove",
      group_id: 5,
    });
    expect(5 in next).toBe(false);
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove",
      group_id: 99,
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — update", () => {
  it("shallow-merges the changed fields onto the existing group", () => {
    const directory = {
      5: makeUserGroup({ id: 5, name: "old", description: "kept" }),
    };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "update",
      group_id: 5,
      data: { name: "new" },
    });
    expect(next[5].name).toBe("new");
    expect(next[5].description).toBe("kept");
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "update",
      group_id: 99,
      data: { name: "ghost" },
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — add_members", () => {
  it("appends new ids to the existing members list", () => {
    const directory = { 5: makeUserGroup({ id: 5, members: [1, 2] }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_members",
      group_id: 5,
      user_ids: [3, 4],
    });
    expect(next[5].members).toEqual([1, 2, 3, 4]);
  });

  it("deduplicates members already present", () => {
    const directory = { 5: makeUserGroup({ id: 5, members: [1, 2] }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_members",
      group_id: 5,
      user_ids: [2, 3],
    });
    expect(next[5].members).toEqual([1, 2, 3]);
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_members",
      group_id: 99,
      user_ids: [1],
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — remove_members", () => {
  it("filters listed ids out of members", () => {
    const directory = { 5: makeUserGroup({ id: 5, members: [1, 2, 3] }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove_members",
      group_id: 5,
      user_ids: [2],
    });
    expect(next[5].members).toEqual([1, 3]);
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove_members",
      group_id: 99,
      user_ids: [1],
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — add_subgroups", () => {
  it("appends and deduplicates direct_subgroup_ids", () => {
    const directory = {
      5: makeUserGroup({ id: 5, direct_subgroup_ids: [10, 11] }),
    };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_subgroups",
      group_id: 5,
      direct_subgroup_ids: [11, 12],
    });
    expect(next[5].direct_subgroup_ids).toEqual([10, 11, 12]);
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_subgroups",
      group_id: 99,
      direct_subgroup_ids: [10],
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — remove_subgroups", () => {
  it("filters listed ids out of direct_subgroup_ids", () => {
    const directory = {
      5: makeUserGroup({ id: 5, direct_subgroup_ids: [10, 11, 12] }),
    };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove_subgroups",
      group_id: 5,
      direct_subgroup_ids: [11],
    });
    expect(next[5].direct_subgroup_ids).toEqual([10, 12]);
  });

  it("is a no-op for an unknown id", () => {
    const directory = { 5: makeUserGroup({ id: 5 }) };
    const next = applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "remove_subgroups",
      group_id: 99,
      direct_subgroup_ids: [10],
    });
    expect(next).toBe(directory);
  });
});

describe("applyUserGroupEvent — non-mutation", () => {
  it("does not mutate the input directory or the existing group on update", () => {
    const original = makeUserGroup({ id: 5, name: "old", members: [1, 2] });
    const directory = { 5: original };
    applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "update",
      group_id: 5,
      data: { name: "new" },
    });
    expect(original.name).toBe("old");
    expect(directory[5]).toBe(original);
  });

  it("does not mutate the input members array on add_members", () => {
    const members = [1, 2];
    const directory = { 5: makeUserGroup({ id: 5, members }) };
    applyUserGroupEvent(directory, {
      id: 1,
      type: "user_group",
      op: "add_members",
      group_id: 5,
      user_ids: [3],
    });
    expect(members).toEqual([1, 2]);
  });
});

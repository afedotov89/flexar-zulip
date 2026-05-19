import { describe, expect, it } from "vitest";

import type { GroupSettingValue, UserGroup } from "../domain";
import type { UserGroupDirectory } from "../stores/userGroupsReducer";
import { isUserInGroupSetting } from "./groupMembership";

function group(overrides: Partial<UserGroup> & { id: number }): UserGroup {
  return {
    name: `g-${overrides.id}`,
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

function dir(groups: UserGroup[]): UserGroupDirectory {
  const out: UserGroupDirectory = {};
  for (const g of groups) {
    out[g.id] = g;
  }
  return out;
}

describe("isUserInGroupSetting", () => {
  it("returns false for undefined setting or user", () => {
    expect(isUserInGroupSetting(undefined, 7, {})).toBe(false);
    expect(isUserInGroupSetting(11, undefined, {})).toBe(false);
  });

  it("returns true when user is a direct member of the numeric group", () => {
    const d = dir([group({ id: 11, members: [7] })]);
    expect(isUserInGroupSetting(11, 7, d)).toBe(true);
  });

  it("returns false when user is not in the numeric group", () => {
    const d = dir([group({ id: 11, members: [8, 9] })]);
    expect(isUserInGroupSetting(11, 7, d)).toBe(false);
  });

  it("follows transitive subgroup membership", () => {
    const d = dir([
      group({ id: 11, direct_subgroup_ids: [12] }),
      group({ id: 12, members: [7] }),
    ]);
    expect(isUserInGroupSetting(11, 7, d)).toBe(true);
  });

  it("walks multi-level subgroup chains", () => {
    const d = dir([
      group({ id: 11, direct_subgroup_ids: [12] }),
      group({ id: 12, direct_subgroup_ids: [13] }),
      group({ id: 13, members: [7] }),
    ]);
    expect(isUserInGroupSetting(11, 7, d)).toBe(true);
  });

  it("tolerates subgroup cycles without infinite recursion", () => {
    const d = dir([
      group({ id: 11, direct_subgroup_ids: [12] }),
      group({ id: 12, direct_subgroup_ids: [11], members: [7] }),
    ]);
    expect(isUserInGroupSetting(11, 7, d)).toBe(true);
  });

  it("returns false when the numeric group is unknown to the directory", () => {
    expect(isUserInGroupSetting(99, 7, {})).toBe(false);
  });

  it("matches anonymous-form direct_members", () => {
    const setting: GroupSettingValue = {
      direct_members: [7],
      direct_subgroups: [],
    };
    expect(isUserInGroupSetting(setting, 7, {})).toBe(true);
  });

  it("matches anonymous-form via direct_subgroups", () => {
    const d = dir([group({ id: 11, members: [7] })]);
    const setting: GroupSettingValue = {
      direct_members: [],
      direct_subgroups: [11],
    };
    expect(isUserInGroupSetting(setting, 7, d)).toBe(true);
  });

  it("returns false when neither anonymous list matches", () => {
    const d = dir([group({ id: 11, members: [8] })]);
    const setting: GroupSettingValue = {
      direct_members: [9],
      direct_subgroups: [11],
    };
    expect(isUserInGroupSetting(setting, 7, d)).toBe(false);
  });
});

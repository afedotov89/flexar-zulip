// Tests for `findGroupUsages` (Phase C5).
//
// Cases: empty world, channel direct-number references (single +
// multiple), channel object-form (`direct_subgroups`), group `can_*`
// references, group direct-subgroup edges, self-exclusion, mixed
// order. Each case constructs minimal fixtures inline.

import { describe, expect, it } from "vitest";
import type { GroupSettingValue, Stream, UserGroup } from "../../domain";
import { findGroupUsages } from "./findGroupUsages";

const PUBLIC: GroupSettingValue = 1;

function makeChannel(overrides: Partial<Stream> & { stream_id: number }): Stream {
  return {
    name: `channel-${overrides.stream_id}`,
    description: "",
    rendered_description: "",
    is_archived: false,
    invite_only: false,
    is_web_public: false,
    history_public_to_subscribers: true,
    creator_id: null,
    message_retention_days: null,
    first_message_id: null,
    folder_id: null,
    stream_weekly_traffic: null,
    subscriber_count: 0,
    date_created: 0,
    is_recently_active: false,
    ...overrides,
  };
}

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
    can_add_members_group: PUBLIC,
    can_join_group: PUBLIC,
    can_leave_group: PUBLIC,
    can_manage_group: PUBLIC,
    can_mention_group: PUBLIC,
    can_remove_members_group: PUBLIC,
    ...overrides,
  };
}

describe("findGroupUsages", () => {
  it("returns an empty array when nothing references the group", () => {
    const result = findGroupUsages(99, {
      channels: [makeChannel({ stream_id: 1 })],
      groups: [makeGroup({ id: 5 })],
    });
    expect(result).toEqual([]);
  });

  it("emits a usage when a channel references the group by direct number", () => {
    const result = findGroupUsages(99, {
      channels: [
        makeChannel({
          stream_id: 1,
          name: "general",
          can_send_message_group: 99,
        }),
      ],
      groups: [],
    });
    expect(result).toEqual([
      {
        kind: "channel",
        id: 1,
        name: "general",
        setting: "can_send_message_group",
      },
    ]);
  });

  it("emits a usage when a channel references via `direct_subgroups`", () => {
    const result = findGroupUsages(99, {
      channels: [
        makeChannel({
          stream_id: 1,
          name: "general",
          can_send_message_group: {
            direct_members: [],
            direct_subgroups: [99],
          },
        }),
      ],
      groups: [],
    });
    expect(result).toEqual([
      {
        kind: "channel",
        id: 1,
        name: "general",
        setting: "can_send_message_group",
      },
    ]);
  });

  it("emits one usage per matching setting on the same channel", () => {
    const result = findGroupUsages(99, {
      channels: [
        makeChannel({
          stream_id: 1,
          name: "general",
          can_send_message_group: 99,
          can_administer_channel_group: 99,
          can_subscribe_group: {
            direct_members: [],
            direct_subgroups: [99],
          },
        }),
      ],
      groups: [],
    });
    expect(result).toHaveLength(3);
    expect(result.map((u) => u.setting)).toEqual(
      expect.arrayContaining([
        "can_send_message_group",
        "can_administer_channel_group",
        "can_subscribe_group",
      ]),
    );
    expect(result.every((u) => u.kind === "channel" && u.id === 1)).toBe(true);
  });

  it("emits a usage when a group references via `can_manage_group`", () => {
    const result = findGroupUsages(99, {
      channels: [],
      groups: [makeGroup({ id: 5, name: "ops", can_manage_group: 99 })],
    });
    expect(result).toEqual([
      { kind: "group", id: 5, name: "ops", setting: "can_manage_group" },
    ]);
  });

  it("emits a 'подгруппа' usage when listed in another group's direct_subgroup_ids", () => {
    const result = findGroupUsages(99, {
      channels: [],
      groups: [
        makeGroup({ id: 5, name: "ops", direct_subgroup_ids: [99, 100] }),
      ],
    });
    expect(result).toEqual([
      { kind: "group", id: 5, name: "ops", setting: "подгруппа" },
    ]);
  });

  it("never includes the target group itself even if its own data references it", () => {
    // Pathological inputs: the group claims itself as a subgroup and
    // via a can_*_group. Both must be silently ignored.
    const result = findGroupUsages(99, {
      channels: [],
      groups: [
        makeGroup({
          id: 99,
          name: "self",
          can_manage_group: 99,
          direct_subgroup_ids: [99],
        }),
      ],
    });
    expect(result).toEqual([]);
  });

  it("orders channels first (alpha), then groups (alpha)", () => {
    const result = findGroupUsages(99, {
      channels: [
        makeChannel({
          stream_id: 20,
          name: "zeta",
          can_send_message_group: 99,
        }),
        makeChannel({
          stream_id: 10,
          name: "alpha",
          can_send_message_group: 99,
        }),
      ],
      groups: [
        makeGroup({ id: 200, name: "zeb", can_manage_group: 99 }),
        makeGroup({ id: 100, name: "ann", direct_subgroup_ids: [99] }),
      ],
    });
    expect(
      result.map((u) => ({ kind: u.kind, name: u.name, setting: u.setting })),
    ).toEqual([
      { kind: "channel", name: "alpha", setting: "can_send_message_group" },
      { kind: "channel", name: "zeta", setting: "can_send_message_group" },
      { kind: "group", name: "ann", setting: "подгруппа" },
      { kind: "group", name: "zeb", setting: "can_manage_group" },
    ]);
  });
});

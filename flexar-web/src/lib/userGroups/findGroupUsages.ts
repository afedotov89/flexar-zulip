// Pure helper: find every place a user group is referenced by another
// channel or user group (Phase C5 — Danger zone usage check).
//
// The Danger zone's deactivate flow refuses to proceed while the group
// is still wired into channel permissions or another group's
// permissions / subgraph. This helper enumerates those references in a
// stable order so the UI can render a "cannot deactivate" banner with
// one row per blocker.
//
// What counts as a usage:
//   - For each channel: every `can_*_group` field where the value is
//     either the target id directly (number form) or the target id is
//     among its `direct_subgroups` (object form).
//   - For each *other* user group: every `can_*_group` field, plus a
//     direct-subgroup edge (`direct_subgroup_ids` includes the target).
//
// What never counts: the target group itself. A group cannot be its
// own subgroup or its own permission holder; even if the server
// somehow surfaced such a reference, listing it would only confuse the
// admin.
//
// Ordering: channels first (alphabetical by name), then groups
// (alphabetical by name); within an owner, the per-setting order is
// the order the fields are declared below (a fixed list — stable
// across calls, independent of object key order).
//
// Pure function — no React, no stores, no side effects. All inputs are
// passed explicitly so the consumer (`DangerTab`) decides which
// snapshot to feed it.

import type { GroupSettingValue, Stream, UserGroup } from "../../domain";

/** A single reference to a user group from a channel or another group. */
export interface GroupUsage {
  /** Where the group is referenced. */
  kind: "channel" | "group";
  /** The owning entity's id (`stream_id` for channels, `id` for groups). */
  id: number;
  /** Display name of the owning entity. */
  name: string;
  /**
   * Which setting on the owning entity references the target group —
   * e.g. `"can_send_message_group"` or, for direct-subgroup edges,
   * `"подгруппа"`.
   */
  setting: string;
}

// Channel permission fields, in the order we want them surfaced. Kept
// as a tuple so adding a new one is a single-line change and the
// rendering order stays stable.
const CHANNEL_PERMISSION_FIELDS = [
  "can_administer_channel_group",
  "can_add_subscribers_group",
  "can_remove_subscribers_group",
  "can_subscribe_group",
  "can_send_message_group",
  "can_create_topic_group",
  "can_resolve_topics_group",
  "can_move_messages_within_channel_group",
  "can_move_messages_out_of_channel_group",
  "can_delete_any_message_group",
  "can_delete_own_message_group",
] as const satisfies ReadonlyArray<keyof Stream>;

// Group permission fields, in the order we want them surfaced.
const GROUP_PERMISSION_FIELDS = [
  "can_manage_group",
  "can_join_group",
  "can_leave_group",
  "can_add_members_group",
  "can_remove_members_group",
  "can_mention_group",
] as const satisfies ReadonlyArray<keyof UserGroup>;

function references(value: GroupSettingValue | undefined, target: number): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "number") {
    return value === target;
  }
  return value.direct_subgroups.includes(target);
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  items.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  return items;
}

export function findGroupUsages(
  groupId: number,
  args: {
    channels: ReadonlyArray<Stream>;
    groups: ReadonlyArray<UserGroup>;
  },
): GroupUsage[] {
  const usages: GroupUsage[] = [];

  const sortedChannels = sortByName([...args.channels]);
  for (const channel of sortedChannels) {
    for (const field of CHANNEL_PERMISSION_FIELDS) {
      if (references(channel[field], groupId)) {
        usages.push({
          kind: "channel",
          id: channel.stream_id,
          name: channel.name,
          setting: field,
        });
      }
    }
  }

  // Skip the target group itself — a group can't reference itself,
  // and surfacing such a row would only confuse the admin.
  const sortedGroups = sortByName(
    args.groups.filter((g) => g.id !== groupId),
  );
  for (const group of sortedGroups) {
    for (const field of GROUP_PERMISSION_FIELDS) {
      if (references(group[field], groupId)) {
        usages.push({
          kind: "group",
          id: group.id,
          name: group.name,
          setting: field,
        });
      }
    }
    if (group.direct_subgroup_ids.includes(groupId)) {
      usages.push({
        kind: "group",
        id: group.id,
        name: group.name,
        setting: "подгруппа",
      });
    }
  }

  return usages;
}

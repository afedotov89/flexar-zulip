// Pure reducers for the user-groups store (Phase A2).
//
// The user-groups store holds the realm's user-group directory keyed by
// `id`. It is hydrated from the register snapshot's `realm_user_groups`
// array and then folded forward by `user_group` events:
//
//   - `op: "add"`              — group created OR reactivated; full
//                                `UserGroup` payload in `event.group`.
//   - `op: "remove"`           — group deactivated; drop by `group_id`.
//   - `op: "update"`           — partial-field update (`name`,
//                                `description`, `deactivated`, any of
//                                the six `can_*_group` settings).
//   - `op: "add_members"`      — append `user_ids` to `members`
//                                (deduplicated).
//   - `op: "remove_members"`   — filter `user_ids` out of `members`.
//   - `op: "add_subgroups"`    — append `direct_subgroup_ids`.
//   - `op: "remove_subgroups"` — filter `direct_subgroup_ids`.
//
// `UserGroupDirectory` is a plain `Record` keyed by id — the natural
// shape for the read-path UI, which looks groups up by id (group
// settings, channel permission-group rendering, group mentions).
// Reducers are pure: they return a new record / new group object and
// never mutate the input.

import type { UserGroup, UserGroupEvent, UserId } from "../domain";
import type { InitialState } from "../realtime";

/** The user-group directory: every known group, keyed by `id`. */
export type UserGroupDirectory = Record<number, UserGroup>;

/**
 * Build the directory from a register snapshot's `realm_user_groups`.
 * Returns an empty directory when the key is missing or not an array
 * (the `fetch_event_types` did not request `user_group`).
 */
export function userGroupsFromInitialState(
  state: InitialState,
): UserGroupDirectory {
  const directory: UserGroupDirectory = {};
  const raw = state.realm_user_groups;
  if (Array.isArray(raw)) {
    for (const group of raw as UserGroup[]) {
      directory[group.id] = group;
    }
  }
  return directory;
}

/**
 * Fold one `user_group` event into the directory. Returns a new
 * directory; the input is never mutated. Unknown ids on every op are
 * tolerated as no-ops — events can race ahead of a directory that a
 * narrower `fetch_event_types` left incomplete.
 */
export function applyUserGroupEvent(
  directory: UserGroupDirectory,
  event: UserGroupEvent,
): UserGroupDirectory {
  switch (event.op) {
    case "add": {
      return { ...directory, [event.group.id]: event.group };
    }
    case "remove": {
      if (!(event.group_id in directory)) {
        return directory;
      }
      const next = { ...directory };
      delete next[event.group_id];
      return next;
    }
    case "update": {
      const existing = directory[event.group_id];
      if (existing === undefined) {
        return directory;
      }
      return {
        ...directory,
        [event.group_id]: { ...existing, ...event.data },
      };
    }
    case "add_members": {
      const existing = directory[event.group_id];
      if (existing === undefined) {
        return directory;
      }
      const merged: UserId[] = [
        ...existing.members,
        ...event.user_ids.filter((id) => !existing.members.includes(id)),
      ];
      return {
        ...directory,
        [event.group_id]: { ...existing, members: merged },
      };
    }
    case "remove_members": {
      const existing = directory[event.group_id];
      if (existing === undefined) {
        return directory;
      }
      const toDrop = new Set(event.user_ids);
      return {
        ...directory,
        [event.group_id]: {
          ...existing,
          members: existing.members.filter((id) => !toDrop.has(id)),
        },
      };
    }
    case "add_subgroups": {
      const existing = directory[event.group_id];
      if (existing === undefined) {
        return directory;
      }
      const merged: number[] = [
        ...existing.direct_subgroup_ids,
        ...event.direct_subgroup_ids.filter(
          (id) => !existing.direct_subgroup_ids.includes(id),
        ),
      ];
      return {
        ...directory,
        [event.group_id]: { ...existing, direct_subgroup_ids: merged },
      };
    }
    case "remove_subgroups": {
      const existing = directory[event.group_id];
      if (existing === undefined) {
        return directory;
      }
      const toDrop = new Set(event.direct_subgroup_ids);
      return {
        ...directory,
        [event.group_id]: {
          ...existing,
          direct_subgroup_ids: existing.direct_subgroup_ids.filter(
            (id) => !toDrop.has(id),
          ),
        },
      };
    }
  }
}

// Server-state store: the realm's user-group directory (Phase A2).
//
// Holds every user group keyed by `id`, for the read-path UI that
// resolves group ids to groups (group mentions, channel
// permission-group rendering, the user-groups admin page).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `realm_user_groups` at connect time, re-hydrates on every
// re-register, and folds `user_group` events on top. The pure
// reducers live in `./userGroupsReducer`.
//
// No `persist`: user-groups can drift while the user is offline in
// ways (membership graph changes, permission-setting edits) that a
// cached snapshot would silently misrepresent. The next `register`
// snapshot is the single source of truth — paying the few-second
// hydration latency is worth never serving stale permission data.

import { create } from "zustand";
import type { UserGroup } from "../domain";
import { isUserGroupEvent } from "./eventGuards";
import {
  applyUserGroupEvent,
  userGroupsFromInitialState,
  type UserGroupDirectory,
} from "./userGroupsReducer";
import { wireStore } from "./wireStore";

export interface UserGroupsState {
  /** Every known user group, keyed by `id`. Empty before first hydrate. */
  userGroups: UserGroupDirectory;
  /** Look up a single group by id, or `undefined` if not in the directory. */
  getUserGroup: (id: number) => UserGroup | undefined;
  /** All groups, sorted by `name` (case-insensitive). */
  getAllUserGroups: () => UserGroup[];
}

export const useUserGroupsStore = create<UserGroupsState>()((_set, get) => ({
  userGroups: {},
  getUserGroup: (id) => get().userGroups[id],
  getAllUserGroups: () => {
    const all = Object.values(get().userGroups);
    all.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    return all;
  },
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useUserGroupsStore.setState({
      userGroups: userGroupsFromInitialState(state),
    });
  },
  applyEvent: (event) => {
    if (!isUserGroupEvent(event)) {
      return;
    }
    useUserGroupsStore.setState((state) => ({
      userGroups: applyUserGroupEvent(state.userGroups, event),
    }));
  },
});

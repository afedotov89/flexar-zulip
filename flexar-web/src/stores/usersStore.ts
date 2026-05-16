// Server-state store: the organization's user directory (Phase 1.3,
// persist added 2-redesign).
//
// Holds every known user keyed by `user_id`, for the read-path UI that
// resolves ids to people (message senders, subscriber lists, presence
// rows, autocomplete).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `realm_users` at connect time, re-hydrates on every re-register, and
// folds `realm_user` add/remove/update events on top. The pure
// reducers live in `./usersReducer`.
//
// `persist`: the directory is mirrored to `localStorage` so a hard
// reload renders sidebars and message-row names instantly from cache
// — without it the sidebars sit in skeletons until the register
// snapshot lands (several seconds on slow networks). The realtime
// register overwrites the cache the moment it arrives; staleness
// window is the time between reload and the next snapshot.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserId } from "../domain";
import { isRealmUserEvent } from "./eventGuards";
import {
  applyRealmUserEvent,
  directoryFromInitialState,
  type UserDirectory,
} from "./usersReducer";
import { wireStore } from "./wireStore";

export interface UsersState {
  /** Every known user, keyed by `user_id`. Empty before first hydrate. */
  users: UserDirectory;
  /** Look up a single user by id, or `undefined` if not in the directory. */
  getUser: (userId: UserId) => User | undefined;
}

export const useUsersStore = create<UsersState>()(
  persist(
    (_set, get) => ({
      users: {},
      getUser: (userId) => get().users[userId],
    }),
    {
      name: "flexar-hub-users",
      // Only the data is durable; `getUser` is recreated on module
      // load and isn't serialisable anyway.
      partialize: (state) => ({ users: state.users }),
    },
  ),
);

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useUsersStore.setState({ users: directoryFromInitialState(state) });
  },
  applyEvent: (event) => {
    if (!isRealmUserEvent(event)) {
      return;
    }
    useUsersStore.setState((state) => ({
      users: applyRealmUserEvent(state.users, event),
    }));
  },
});

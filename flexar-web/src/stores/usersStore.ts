// Server-state store: the organization's user directory (Phase 1.3).
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
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data.

import { create } from "zustand";
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

export const useUsersStore = create<UsersState>()((_set, get) => ({
  users: {},
  getUser: (userId) => get().users[userId],
}));

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

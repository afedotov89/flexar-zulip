// Server-state store: per-user status text + emoji (Phase 4.4).
//
// Hydrates from the `user_status` initial-state map (the
// `register` snapshot includes one entry per user who has set a
// status); folds realtime `user_status` events on top through the
// pure reducers in `./userStatusesReducer`.
//
// No `persist`: server state is re-fetched on every connect; persisted
// statuses would silently stale.

import { create } from "zustand";
import type { UserId, UserStatus } from "../domain";
import { isUserStatusEvent } from "./eventGuards";
import {
  applyUserStatusEvent,
  hydrateFromSnapshot,
  type UserStatusMap,
} from "./userStatusesReducer";
import { wireStore } from "./wireStore";

export interface UserStatusesState {
  /** Set statuses keyed by user id. Absent users have no status set. */
  statuses: UserStatusMap;
  /** Look up one user's status, or `undefined` when none is set. */
  getStatus: (userId: UserId) => UserStatus | undefined;
}

export const useUserStatusesStore = create<UserStatusesState>()((_set, get) => ({
  statuses: {},
  getStatus: (userId) => get().statuses[userId],
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    const snapshot = state.user_status;
    if (
      snapshot === undefined ||
      snapshot === null ||
      typeof snapshot !== "object"
    ) {
      useUserStatusesStore.setState({ statuses: {} });
      return;
    }
    useUserStatusesStore.setState({
      statuses: hydrateFromSnapshot(snapshot as Record<string, UserStatus>),
    });
  },
  applyEvent: (event) => {
    if (!isUserStatusEvent(event)) {
      return;
    }
    useUserStatusesStore.setState((state) => ({
      statuses: applyUserStatusEvent(state.statuses, event),
    }));
  },
});

// Server-state store: user presence (Phase 1.3).
//
// Holds a map from `user_id` to that user's modern-format `Presence`
// (two timestamps the read-path UI compares against the current time
// to render an availability indicator).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `presences` key at connect time, re-hydrates on every re-register,
// and folds `presence` events on top. The pure reducers — including
// the modern/legacy event-format handling — live in
// `./presenceReducer`.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data — and presence
// in particular is time-sensitive.

import { create } from "zustand";
import type { Presence, PresenceMap, UserId } from "../domain";
import { isPresenceEvent } from "./eventGuards";
import {
  applyPresenceEvent,
  presenceFromInitialState,
} from "./presenceReducer";
import { wireStore } from "./wireStore";

export interface PresenceState {
  /** Presence keyed by `user_id`. Empty before the first hydrate. */
  presences: PresenceMap;
  /** Look up a single user's presence, or `undefined` if unknown. */
  getPresence: (userId: UserId) => Presence | undefined;
  /**
   * Merge a fresh `presences` snapshot (as returned by both `register`
   * and the `POST /users/me/presence` ping) into state. Used by
   * `usePresenceEmitter` to refresh self + everyone else every minute,
   * since the server does not echo a user's own presence event back to
   * that user's own queue.
   */
  mergePresences: (presences: PresenceMap) => void;
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  presences: {},
  getPresence: (userId) => get().presences[userId],
  mergePresences: (presences) => {
    set((state) => ({ presences: { ...state.presences, ...presences } }));
  },
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    usePresenceStore.setState({ presences: presenceFromInitialState(state) });
  },
  applyEvent: (event) => {
    if (!isPresenceEvent(event)) {
      return;
    }
    usePresenceStore.setState((state) => ({
      presences: applyPresenceEvent(state.presences, event),
    }));
  },
});

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
}

export const usePresenceStore = create<PresenceState>()((_set, get) => ({
  presences: {},
  getPresence: (userId) => get().presences[userId],
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

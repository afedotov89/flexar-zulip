// Server-state store: the organization ("realm") metadata (Phase 1.3,
// extended in 5.2).
//
// Holds the `Realm` projection of the register snapshot — name,
// branding URLs, behavioural limits — for the read-path UI (navbar
// branding, compose-box length limits, the org-settings page).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot at
// connect time, re-hydrates on every re-register, and folds `realm`
// events on top through `applyRealmEvent` so admin edits arrive live.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data (contrast
// `authStore`, which persists the session).

import { create } from "zustand";
import type { Realm } from "../domain";
import { isRealmEvent } from "./eventGuards";
import { applyRealmEvent, realmFromInitialState } from "./realmReducer";
import { wireStore } from "./wireStore";

export interface RealmState {
  /**
   * The organization metadata, or `null` before the first register
   * snapshot has been hydrated. Every `Realm` field is itself optional
   * — which keys are populated depends on the server version.
   */
  realm: Realm | null;
}

export const useRealmStore = create<RealmState>()(() => ({
  realm: null,
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useRealmStore.setState({ realm: realmFromInitialState(state) });
  },
  applyEvent: (event) => {
    if (!isRealmEvent(event)) {
      return;
    }
    useRealmStore.setState((state) => ({
      realm: applyRealmEvent(state.realm ?? {}, event),
    }));
  },
});

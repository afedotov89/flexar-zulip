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
// `persist`: realm metadata mirrors to `localStorage` so the navbar
// (org name, icon) and the compose-box length limits render instantly
// after a hard reload — without it the UI sits on defaults until the
// register snapshot lands. Register overwrites the cache the moment
// it arrives.

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

export const useRealmStore = create<RealmState>()(
  persist(
    () => ({
      realm: null as Realm | null,
    }),
    {
      name: "flexar-hub-realm",
      partialize: (state) => ({ realm: state.realm }),
    },
  ),
);

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

// Server-state store: the organization ("realm") metadata (Phase 1.3).
//
// Holds the `Realm` projection of the register snapshot — name,
// branding URLs, behavioural limits — for the read-path UI (navbar
// branding, compose-box length limits, …).
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot at
// connect time and re-hydrates on every re-register. There is no event
// reducer: realm-update events are in the domain `ServerEvent` long
// tail not yet precisely modelled (`UnknownEvent`), so live realm
// changes are a known gap until those events are typed through the
// orchestrator — `register` re-hydration on reconnect bounds how stale
// the data can get in the meantime.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data (contrast
// `authStore`, which persists the session).

import { create } from "zustand";
import type { Realm } from "../domain";
import { realmFromInitialState } from "./realmReducer";
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
// Realm has no event reducer; `applyEvent` is a deliberate no-op.
wireStore({
  hydrate: (state) => {
    useRealmStore.setState({ realm: realmFromInitialState(state) });
  },
  applyEvent: () => {
    // Realm-update events are not yet modelled; see the file header.
  },
});

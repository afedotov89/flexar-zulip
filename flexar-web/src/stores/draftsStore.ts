// Flexar Hub Web — local-drafts store (Phase 2.4).
//
// Holds the user's in-progress compose drafts, one per conversation
// destination. Persists to `localStorage` so a draft survives a reload;
// this is the only `persist`-ed store besides `authStore`.
//
// The shape mirrors `authStore`'s pattern: a `create<State>()(persist(
// (set, get) => …, { name, partialize }))` with the actions bundled
// into the state interface, and a `partialize` that keeps only the
// durable bit (`drafts`).
//
// The store is a thin façade over the pure reducers in
// `./draftsReducer`; the reducers carry the logic and the unit-test
// coverage. The store wires the actions to `set`, the selectors to
// `get`, and the persistence to `localStorage` — nothing else.
//
// Local-only by design: drafts do *not* round-trip through the server
// (Zulip has its own server-side `Draft` type, but Phase 2.4 explicitly
// scopes server-side sync out — see the orchestrator handoff).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deleteDraft,
  listDrafts,
  saveDraft,
  type Draft,
  type DraftMap,
} from "./draftsReducer";

export type { Draft, DraftDestination, DraftMap } from "./draftsReducer";

export interface DraftsState {
  /** Every draft, keyed by `Draft.key`. */
  drafts: DraftMap;
  /** Insert or replace the draft for `draft.key`. */
  saveDraft: (draft: Draft) => void;
  /** Drop the draft for `key`; no-op if absent. */
  deleteDraft: (key: string) => void;
  /** Look up a draft by key, or `undefined`. */
  getDraft: (key: string) => Draft | undefined;
  /** Every draft, sorted recency-desc (see `listDrafts`). */
  listDrafts: () => Draft[];
}

/** localStorage key for the persisted drafts map. */
const STORAGE_KEY = "flexar-hub-drafts";

export const useDraftsStore = create<DraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (draft) => {
        set((state) => ({ drafts: saveDraft(state.drafts, draft) }));
      },
      deleteDraft: (key) => {
        set((state) => ({ drafts: deleteDraft(state.drafts, key) }));
      },
      getDraft: (key) => get().drafts[key],
      listDrafts: () => listDrafts(get().drafts),
    }),
    {
      name: STORAGE_KEY,
      // Only `drafts` is durable. The action methods are bound to the
      // store fresh on each load, so persisting them would be wrong.
      partialize: (state) => ({ drafts: state.drafts }),
    },
  ),
);

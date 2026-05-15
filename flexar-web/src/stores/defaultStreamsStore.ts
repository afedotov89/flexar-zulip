// Server-state store: the realm's default-channel list (Phase 5.2).
//
// "Default channels" are the channels new accounts are auto-subscribed
// to. The list isn't part of the register snapshot, so this store is
// lazy-loaded — the org-settings page calls `loadDefaultStreams()` on
// mount, which fires `GET /default_streams` and caches the response.
//
// Lifecycle, mirroring `topicsStore` / `scheduledMessagesStore`:
//
//   - On (re-)register the cache is reset to `idle` (see the file
//     header in those stores). Admin actions during the gap may have
//     changed the list, and a fresh fetch on next mount is the safe
//     re-hydration.
//   - Realtime `default_streams` events carry the *full* new list (not
//     a delta), so the reducer is a wholesale replace.
//
// No `persist`: server state is re-fetched on every connect and must
// not survive a reload as stale data.

import { create } from "zustand";
import type { StreamId } from "../domain";
import { apiClient } from "../api";
import { isDefaultStreamsEvent } from "./eventGuards";
import { wireStore } from "./wireStore";

/** Load state of the default-streams list. */
export type DefaultStreamsLoadStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "error";

export interface DefaultStreamsState {
  /** Channel ids the realm auto-subscribes new users to. */
  defaultStreams: StreamId[];
  /** Status of the bootstrap fetch. */
  loadStatus: DefaultStreamsLoadStatus;
  /**
   * Fetch the realm's default-channels list. Idempotent: a call while
   * a previous fetch is in flight, or after a successful load, is a
   * no-op. After an error, calling again retries.
   */
  loadDefaultStreams: () => Promise<void>;
}

const EMPTY_LIST: StreamId[] = [];

export const useDefaultStreamsStore = create<DefaultStreamsState>()(
  (set, get) => ({
    defaultStreams: EMPTY_LIST,
    loadStatus: "idle",
    loadDefaultStreams: async () => {
      const status = get().loadStatus;
      if (status === "loading" || status === "loaded") {
        return;
      }
      set({ loadStatus: "loading" });
      try {
        const ids = await apiClient.getDefaultStreams();
        set({ defaultStreams: ids, loadStatus: "loaded" });
      } catch {
        set({ loadStatus: "error" });
      }
    },
  }),
);

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: () => {
    // Default streams aren't in the register snapshot; on a re-register
    // the cached list may be stale, so reset to idle and let the next
    // mount of the admin page re-fetch.
    useDefaultStreamsStore.setState({
      defaultStreams: EMPTY_LIST,
      loadStatus: "idle",
    });
  },
  applyEvent: (event) => {
    if (!isDefaultStreamsEvent(event)) {
      return;
    }
    // Server sends the full new list, not a delta — wholesale replace.
    // If we hadn't loaded yet, treat the event as the bootstrap and
    // mark the cache loaded; otherwise just refresh the list.
    useDefaultStreamsStore.setState({
      defaultStreams: event.default_streams,
      loadStatus: "loaded",
    });
  },
});

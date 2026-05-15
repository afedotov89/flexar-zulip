// Server-state store: the user's undelivered scheduled messages
// (Phase 4.5).
//
// Lifecycle, mirroring `topicsStore` (which is also lazy-fetched):
//
//   - On (re-)register the store is reset to empty (`hydrate`). The
//     `register` snapshot does not include scheduled messages.
//   - The first call to `loadScheduledMessages` issues
//     `GET /scheduled_messages` and populates the bag. The fetch is
//     idempotent — already-loaded / in-flight calls are a no-op.
//   - Realtime `scheduled_messages add | update | remove` events fold
//     into the bag through the pure reducers in
//     `./scheduledMessagesReducer`. Events that arrive *before* the
//     fetch completes still apply, but their effect is overwritten
//     when the fetch resolves — `replaceAll` is correct because the
//     `GET` is the canonical snapshot at that moment and any events
//     that happened during the fetch are re-applied through the
//     queue's normal sequencing.
//
// No `persist`: server state is re-fetched on every connect; persisted
// scheduled messages would be misleading after a delivery.

import { create } from "zustand";
import type { ScheduledMessage } from "../domain";
import { apiClient } from "../api";
import { isScheduledMessagesEvent } from "./eventGuards";
import {
  applyAdd,
  applyRemove,
  applyUpdate,
  listScheduled,
  replaceAll,
  type ScheduledMessageMap,
} from "./scheduledMessagesReducer";
import { wireStore } from "./wireStore";

/** Load state of the scheduled-messages list. */
export type ScheduledMessagesLoadStatus = "idle" | "loading" | "loaded" | "error";

export interface ScheduledMessagesState {
  /** All scheduled messages, keyed by id. */
  scheduledMessages: ScheduledMessageMap;
  /** Status of the bootstrap fetch. */
  loadStatus: ScheduledMessagesLoadStatus;
  /**
   * Fetch the user's scheduled messages. Idempotent: a call while a
   * previous fetch is in flight, or after a successful load, is a
   * no-op. After an error, calling again retries.
   */
  loadScheduledMessages: () => Promise<void>;
  /** All scheduled messages, sorted by delivery time ascending. */
  list: () => ScheduledMessage[];
  /** Look up one scheduled message by id. */
  get: (scheduledMessageId: number) => ScheduledMessage | undefined;
}

export const useScheduledMessagesStore = create<ScheduledMessagesState>()(
  (set, get) => ({
    scheduledMessages: {},
    loadStatus: "idle",
    loadScheduledMessages: async () => {
      const status = get().loadStatus;
      if (status === "loading" || status === "loaded") {
        return;
      }
      set({ loadStatus: "loading" });
      try {
        const messages = await apiClient.getScheduledMessages();
        set({
          scheduledMessages: replaceAll(messages),
          loadStatus: "loaded",
        });
      } catch {
        set({ loadStatus: "error" });
      }
    },
    list: () => listScheduled(get().scheduledMessages),
    get: (scheduledMessageId) => get().scheduledMessages[scheduledMessageId],
  }),
);

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: () => {
    useScheduledMessagesStore.setState({
      scheduledMessages: {},
      loadStatus: "idle",
    });
  },
  applyEvent: (event) => {
    if (!isScheduledMessagesEvent(event)) {
      return;
    }
    if (event.op === "add") {
      useScheduledMessagesStore.setState((state) => ({
        scheduledMessages: applyAdd(state.scheduledMessages, event.scheduled_messages),
      }));
      return;
    }
    if (event.op === "update") {
      useScheduledMessagesStore.setState((state) => ({
        scheduledMessages: applyUpdate(state.scheduledMessages, event.scheduled_message),
      }));
      return;
    }
    // op === "remove"
    useScheduledMessagesStore.setState((state) => ({
      scheduledMessages: applyRemove(state.scheduledMessages, event.scheduled_message_id),
    }));
  },
});

// Server-state store: unread message tracking (Phase 1.3).
//
// Holds a flat set of unread message ids, for the read-path UI's
// unread counts and indicators.
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `unread_msgs` buckets at connect time, re-hydrates on every
// re-register, and folds the unread-affecting events on top —
// `message` (adds), `update_message_flags` with the `read` flag
// (removes / re-adds), `delete_message` (removes). The pure reducers
// live in `./unreadReducer`.
//
// Whether a `message` event counts as unread depends on whether the
// viewer sent it; the viewer's id comes from `authStore` (its
// `session.userId`), read at event time so the store stays in sync
// with the session without holding its own copy.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data.

import { create } from "zustand";
import type { MessageId } from "../domain";
import { useAuthStore } from "./authStore";
import {
  isDeleteMessageEvent,
  isMessageEvent,
  isUpdateMessageFlagsEvent,
} from "./eventGuards";
import {
  applyDeleteMessageEventToUnread,
  applyMessageEventToUnread,
  applyUpdateMessageFlagsEventToUnread,
  unreadCount,
  unreadFromInitialState,
  type UnreadSet,
} from "./unreadReducer";
import { wireStore } from "./wireStore";

export interface UnreadState {
  /** The set of unread message ids. Empty before the first hydrate. */
  unread: UnreadSet;
  /** Whether a given message is currently unread. */
  isUnread: (messageId: MessageId) => boolean;
  /** The total number of unread messages tracked. */
  getUnreadCount: () => number;
}

export const useUnreadStore = create<UnreadState>()((_set, get) => ({
  unread: {},
  isUnread: (messageId) => get().unread[messageId] === true,
  getUnreadCount: () => unreadCount(get().unread),
}));

/** The viewer's own user id, or `null` when no session is established. */
function ownUserId(): number | null {
  return useAuthStore.getState().session?.userId ?? null;
}

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useUnreadStore.setState({ unread: unreadFromInitialState(state) });
  },
  applyEvent: (event) => {
    // Each guard narrows `event` to the precise type its reducer needs;
    // events the store does not own fall through untouched.
    if (isMessageEvent(event)) {
      useUnreadStore.setState((state) => ({
        unread: applyMessageEventToUnread(state.unread, event, ownUserId()),
      }));
      return;
    }
    if (isUpdateMessageFlagsEvent(event)) {
      useUnreadStore.setState((state) => ({
        unread: applyUpdateMessageFlagsEventToUnread(state.unread, event),
      }));
      return;
    }
    if (isDeleteMessageEvent(event)) {
      useUnreadStore.setState((state) => ({
        unread: applyDeleteMessageEventToUnread(state.unread, event),
      }));
    }
  },
});

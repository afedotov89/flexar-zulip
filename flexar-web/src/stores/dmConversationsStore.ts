// Server-state store: the viewer's DM conversations (Phase 1.5a).
//
// Phase 1.5's left sidebar could only list DM conversations that had
// *unread* messages (read off `unreadStore`'s DM buckets). This store
// holds the *full* list of the viewer's DM and group-DM conversations —
// read ones included — in recency order, so the sidebar's Direct
// messages section can show a complete history.
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `recent_private_conversations` key at connect time, re-hydrates on
// every re-register, and folds DM-type `message` events on top (a new
// message bumps its conversation's recency or adds a new conversation).
// The pure reducers live in `./dmConversationsReducer`.
//
// Each conversation is keyed by `conversationKey` — the sorted,
// comma-joined participant ids *including the viewer* — the same
// encoding `unreadStore` and the narrow `dm` operand use, so the
// sidebar can overlay `unreadStore.getDmUnread` onto this list and
// build DM narrows directly from a key.
//
// The viewer's own id (needed to complete each `conversationKey`, since
// the snapshot entries carry only the *other* participants) comes from
// `authStore`, read at hydrate time so the store stays in sync with the
// session without holding its own copy.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data.

import { create } from "zustand";
import { useAuthStore } from "./authStore";
import { isMessageEvent } from "./eventGuards";
import {
  applyMessageEventToDmConversations,
  dmConversationsFromInitialState,
  type DmConversation,
} from "./dmConversationsReducer";
import { wireStore } from "./wireStore";

export interface DmConversationsState {
  /**
   * The viewer's DM conversations, most-recent-first. Empty before the
   * first hydrate.
   */
  conversations: DmConversation[];
  /** The full recency-ordered conversation list. */
  getConversations: () => DmConversation[];
}

export const useDmConversationsStore = create<DmConversationsState>()(
  (_set, get) => ({
    conversations: [],
    getConversations: () => get().conversations,
  }),
);

/** The viewer's own user id, or `null` when no session is established. */
function ownUserId(): number | null {
  return useAuthStore.getState().session?.userId ?? null;
}

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useDmConversationsStore.setState({
      conversations: dmConversationsFromInitialState(state, ownUserId()),
    });
  },
  applyEvent: (event) => {
    if (!isMessageEvent(event)) {
      return;
    }
    useDmConversationsStore.setState((state) => ({
      conversations: applyMessageEventToDmConversations(
        state.conversations,
        event,
      ),
    }));
  },
});

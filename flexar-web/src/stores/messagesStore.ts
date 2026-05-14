// Server-state store: the message cache (Phase 1.3).
//
// Holds messages keyed by `id`, plus the current user's per-message
// `flags`, for the read-path UI. This is the largest server-state
// store and the one Phase 1.6 (history fetch + feed virtualization)
// builds on.
//
// Lifecycle (see `wireStore`): the register snapshot carries no message
// bodies, so there is *no* hydration from initial state — the store
// starts empty and is filled two ways:
//   - `ingest(messages, flagsById?)` — the seam Phase 1.6's
//     `getMessages` history fetch writes through.
//   - the live event stream — `message`, `update_message`,
//     `delete_message`, `reaction`, `update_message_flags` — folded by
//     the pure reducers in `./messagesReducer`.
//
// On re-register the cache is *cleared* (`hydrate` resets to empty):
// the message stream restarts from the new queue's cursor, and Phase
// 1.6 re-fetches the visible history, so keeping a stale cache across
// the gap would risk showing messages the viewer may have lost access
// to. An empty cache is the safe, correct re-hydration.
//
// No `persist`: server state is re-fetched on every connect and must
// not survive a reload as stale data.

import { create } from "zustand";
import type { Message, MessageFlag, MessageId } from "../domain";
import {
  isDeleteMessageEvent,
  isMessageEvent,
  isReactionEvent,
  isUpdateMessageEvent,
  isUpdateMessageFlagsEvent,
} from "./eventGuards";
import {
  applyDeleteMessageEvent,
  applyMessageEvent,
  applyReactionEvent,
  applyUpdateMessageEvent,
  applyUpdateMessageFlagsEvent,
  emptyMessagesSnapshot,
  ingestMessages,
  type FlagMap,
  type MessageMap,
} from "./messagesReducer";
import { wireStore } from "./wireStore";

export interface MessagesState {
  /** The message cache, keyed by `id`. Empty until messages arrive. */
  messages: MessageMap;
  /** The current user's per-message flags, keyed by message `id`. */
  flags: FlagMap;
  /** Look up a single cached message by id, or `undefined`. */
  getMessage: (messageId: MessageId) => Message | undefined;
  /** The current user's flags for a message; `[]` if none / unknown. */
  getFlags: (messageId: MessageId) => MessageFlag[];
  /**
   * Bulk-insert fetched messages into the cache. Phase 1.6's history
   * fetch writes through here; `flagsById` is optional for sources
   * that do not carry per-viewer flags.
   */
  ingest: (
    messages: readonly Message[],
    flagsById?: Readonly<Record<MessageId, MessageFlag[]>>,
  ) => void;
}

const EMPTY_FLAGS: MessageFlag[] = [];

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  ...emptyMessagesSnapshot(),
  getMessage: (messageId) => get().messages[messageId],
  getFlags: (messageId) => get().flags[messageId] ?? EMPTY_FLAGS,
  ingest: (messages, flagsById) => {
    set((state) =>
      ingestMessages(
        { messages: state.messages, flags: state.flags },
        messages,
        flagsById,
      ),
    );
  },
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: () => {
    // No message bodies in the register snapshot; a re-register clears
    // the cache (see the file header) and Phase 1.6 re-fetches.
    useMessagesStore.setState(emptyMessagesSnapshot());
  },
  applyEvent: (event) => {
    // Each guard narrows `event` to the precise type its reducer needs;
    // events the store does not own fall through untouched.
    if (isMessageEvent(event)) {
      useMessagesStore.setState((state) =>
        applyMessageEvent(
          { messages: state.messages, flags: state.flags },
          event,
        ),
      );
      return;
    }
    if (isUpdateMessageEvent(event)) {
      useMessagesStore.setState((state) =>
        applyUpdateMessageEvent(
          { messages: state.messages, flags: state.flags },
          event,
        ),
      );
      return;
    }
    if (isDeleteMessageEvent(event)) {
      useMessagesStore.setState((state) =>
        applyDeleteMessageEvent(
          { messages: state.messages, flags: state.flags },
          event,
        ),
      );
      return;
    }
    if (isReactionEvent(event)) {
      useMessagesStore.setState((state) =>
        applyReactionEvent(
          { messages: state.messages, flags: state.flags },
          event,
        ),
      );
      return;
    }
    if (isUpdateMessageFlagsEvent(event)) {
      useMessagesStore.setState((state) =>
        applyUpdateMessageFlagsEvent(
          { messages: state.messages, flags: state.flags },
          event,
        ),
      );
    }
  },
});

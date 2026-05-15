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
export type {
  OptimisticDelete,
  OptimisticEdit,
  OptimisticFlag,
} from "./messagesReducer";
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
  applyOptimisticDelete,
  applyOptimisticEdit,
  applyOptimisticFlag,
  applyOptimisticReaction,
  applyReactionEvent,
  applyUpdateMessageEvent,
  applyUpdateMessageFlagsEvent,
  emptyMessagesSnapshot,
  ingestMessages,
  insertOptimisticMessage,
  reconcileOptimisticMessage,
  removeOptimisticMessage,
  restoreFlags,
  restoreMessage,
  type FlagMap,
  type MessageMap,
  type OptimisticDelete,
  type OptimisticEdit,
  type OptimisticFlag,
  type OptimisticReaction,
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
  /**
   * Insert an optimistic-echo message (Phase 2.2). The compose layer
   * writes through here so the user's freshly sent message appears
   * immediately. The id must be a *local* id (Zulip ids are positive
   * integers — the compose layer uses negatives to guarantee no clash
   * with a real id).
   */
  insertOptimistic: (
    message: Message,
    flags?: readonly MessageFlag[],
  ) => void;
  /**
   * Reconcile an optimistic-echo entry with the real server-assigned
   * message (Phase 2.2). Removes the optimistic entry; inserts the
   * real one only if it is not already in the cache (the live
   * `message` event may have raced ahead).
   */
  reconcileOptimistic: (localId: MessageId, realMessage: Message) => void;
  /**
   * Drop an optimistic-echo entry (Phase 2.2). Used on send failure to
   * remove the message that never made it.
   */
  removeOptimistic: (localId: MessageId) => void;
  /**
   * Optimistically add or remove a reaction in the cache (Phase 3.2).
   * The reactions UI calls this immediately on click — before the REST
   * call — so the chip updates without a round-trip; the realtime
   * `reaction` event arrives shortly after, and the event reducer is
   * idempotent on the same `(user, type, code)` triple. On REST failure
   * the caller flips `op` and runs this same action to revert.
   */
  applyOptimisticReaction: (pending: OptimisticReaction) => void;
  /**
   * Optimistically swap in new content for a cached message (Phase 3.3).
   * The edit form calls this immediately on Save; the realtime
   * `update_message` event reconciles. On REST failure the caller
   * passes the original `Message` snapshot to `restoreMessage` to roll
   * back. A no-op on uncached ids.
   */
  applyOptimisticEdit: (pending: OptimisticEdit) => void;
  /**
   * Optimistically drop a cached message and its flags (Phase 3.3).
   * The delete-confirm modal calls this immediately on confirm; the
   * realtime `delete_message` event is idempotent. On REST failure the
   * caller restores the snapshotted `Message` (`restoreMessage`) and
   * any per-viewer flags (`restoreFlags`).
   */
  applyOptimisticDelete: (pending: OptimisticDelete) => void;
  /**
   * Optimistically add or remove a per-viewer flag on one cached
   * message (Phase 3.3). Star/unstar and mark-unread call this
   * immediately; the realtime `update_message_flags` event reconciles.
   * On REST failure the caller flips `op` and runs this same action
   * to revert.
   */
  applyOptimisticFlag: (pending: OptimisticFlag) => void;
  /**
   * Re-insert a previously-cached `Message` by id (Phase 3.3). Used to
   * revert a failed optimistic edit or delete: the caller snapshotted
   * the original `Message` before the optimistic change.
   */
  restoreMessage: (message: Message) => void;
  /**
   * Re-attach previously-cached `flags` for a message id (Phase 3.3).
   * Used together with `restoreMessage` to revert a failed optimistic
   * delete.
   */
  restoreFlags: (messageId: MessageId, flags: readonly MessageFlag[]) => void;
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
  insertOptimistic: (message, flags) => {
    set((state) =>
      insertOptimisticMessage(
        { messages: state.messages, flags: state.flags },
        message,
        flags,
      ),
    );
  },
  reconcileOptimistic: (localId, realMessage) => {
    set((state) =>
      reconcileOptimisticMessage(
        { messages: state.messages, flags: state.flags },
        localId,
        realMessage,
      ),
    );
  },
  removeOptimistic: (localId) => {
    set((state) =>
      removeOptimisticMessage(
        { messages: state.messages, flags: state.flags },
        localId,
      ),
    );
  },
  applyOptimisticReaction: (pending) => {
    set((state) =>
      applyOptimisticReaction(
        { messages: state.messages, flags: state.flags },
        pending,
      ),
    );
  },
  applyOptimisticEdit: (pending) => {
    set((state) =>
      applyOptimisticEdit(
        { messages: state.messages, flags: state.flags },
        pending,
      ),
    );
  },
  applyOptimisticDelete: (pending) => {
    set((state) =>
      applyOptimisticDelete(
        { messages: state.messages, flags: state.flags },
        pending,
      ),
    );
  },
  applyOptimisticFlag: (pending) => {
    set((state) =>
      applyOptimisticFlag(
        { messages: state.messages, flags: state.flags },
        pending,
      ),
    );
  },
  restoreMessage: (message) => {
    set((state) =>
      restoreMessage({ messages: state.messages, flags: state.flags }, message),
    );
  },
  restoreFlags: (messageId, flags) => {
    set((state) =>
      restoreFlags(
        { messages: state.messages, flags: state.flags },
        messageId,
        flags,
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

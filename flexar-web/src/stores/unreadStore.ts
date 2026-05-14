// Server-state store: unread message tracking (Phase 1.3, restructured
// in 1.5).
//
// Holds the viewer's unread messages in a *bucketed* shape — per
// channel-topic and per DM conversation — so the left sidebar can show
// a per-conversation unread count, not just a grand total. The bucket
// model and the pure reducers live in `./unreadReducer`.
//
// Lifecycle (see `wireStore`): hydrates from the register snapshot's
// `unread_msgs` buckets at connect time, re-hydrates on every
// re-register, and folds the unread-affecting events on top —
// `message` (files a new unread message into its bucket),
// `update_message` (re-buckets messages moved between topics/channels),
// `update_message_flags` with the `read` flag (removes / restores),
// `delete_message` (removes). The reducers are pure and unit-tested.
//
// Whether a `message` event counts as unread, and which DM key a `pms`
// snapshot bucket gets, both depend on the viewer's own user id; it
// comes from `authStore` (its `session.userId`), read at event/hydrate
// time so the store stays in sync with the session without holding its
// own copy.
//
// No `persist`: server state is re-fetched from `register` on every
// connect and must not survive a reload as stale data.

import { create } from "zustand";
import type { MessageId, StreamId } from "../domain";
import { useAuthStore } from "./authStore";
import {
  isDeleteMessageEvent,
  isMessageEvent,
  isUpdateMessageEvent,
  isUpdateMessageFlagsEvent,
} from "./eventGuards";
import {
  applyDeleteMessageEventToUnread,
  applyMessageEventToUnread,
  applyUpdateMessageEventToUnread,
  applyUpdateMessageFlagsEventToUnread,
  channelUnreadCount,
  dmConversationKeysWithUnread,
  dmUnreadCount,
  emptyUnreadBuckets,
  isUnread,
  topicUnreadCount,
  unreadCount,
  unreadFromInitialState,
  type UnreadBuckets,
} from "./unreadReducer";
import { wireStore } from "./wireStore";

export interface UnreadState {
  /** The bucketed unread state. Empty before the first hydrate. */
  unread: UnreadBuckets;
  /** Whether a given message is currently unread. */
  isUnread: (messageId: MessageId) => boolean;
  /** The total number of unread messages tracked, across all buckets. */
  getUnreadCount: () => number;
  /** Unread count for one channel, summed across all its topics. */
  getChannelUnread: (streamId: StreamId) => number;
  /** Unread count for one channel-topic. */
  getTopicUnread: (streamId: StreamId, topic: string) => number;
  /**
   * Unread count for one DM conversation. The key is the sorted,
   * comma-joined participant user ids (including the viewer) — see
   * `dmConversationKey` in `./unreadReducer`.
   */
  getDmUnread: (conversationKey: string) => number;
  /** The conversation keys of every DM that currently has unread messages. */
  getDmConversationKeys: () => string[];
}

export const useUnreadStore = create<UnreadState>()((_set, get) => ({
  unread: emptyUnreadBuckets(),
  isUnread: (messageId) => isUnread(get().unread, messageId),
  getUnreadCount: () => unreadCount(get().unread),
  getChannelUnread: (streamId) => channelUnreadCount(get().unread, streamId),
  getTopicUnread: (streamId, topic) =>
    topicUnreadCount(get().unread, streamId, topic),
  getDmUnread: (conversationKey) => dmUnreadCount(get().unread, conversationKey),
  getDmConversationKeys: () => dmConversationKeysWithUnread(get().unread),
}));

/** The viewer's own user id, or `null` when no session is established. */
function ownUserId(): number | null {
  return useAuthStore.getState().session?.userId ?? null;
}

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: (state) => {
    useUnreadStore.setState({
      unread: unreadFromInitialState(state, ownUserId()),
    });
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
    if (isUpdateMessageEvent(event)) {
      useUnreadStore.setState((state) => ({
        unread: applyUpdateMessageEventToUnread(state.unread, event),
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

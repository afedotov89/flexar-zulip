// Server-state store: who is currently typing where (Phase 4.3).
//
// Per-conversation set of sender ids that are actively typing,
// updated by realtime `typing` events with `op:start` / `op:stop`.
//
// Conversation key encoding:
//
//   - Direct messages: the sorted, comma-joined list of every
//     participant's user id, including the viewer's own id (matches
//     `dmConversationKey` in `unreadReducer`).
//   - Channel messages: `channel:{streamId}:{topic}`.
//
// Stale-entry sweeping: the server sometimes drops the matching
// `stop` event (browser tab closed, network glitch); a stale "X is
// typing…" hanging around forever is the worst possible UX. The
// store keeps a `lastSeenMs` timestamp per (conversationKey, userId)
// pair and `pruneStale()` evicts anything older than the timeout —
// the dispatcher (`useTypingSweeper`) calls it on a 1s interval.
//
// No `persist`: typing state is realtime-only and would be misleading
// stored across reloads.

import { create } from "zustand";
import type { UserId } from "../domain";
import { useAuthStore } from "./authStore";
import { isTypingEvent } from "./eventGuards";
import { wireStore } from "./wireStore";

/** How long without a refresh we treat a typing entry as stale. */
export const TYPING_STALE_AFTER_MS = 15_000;

/**
 * Encode the typing-bucket key for a DM conversation: sorted user-id
 * list including the viewer, comma-joined. Mirrors `dmConversationKey`.
 */
export function typingDmKey(participantIds: readonly UserId[]): string {
  const unique = Array.from(new Set(participantIds));
  unique.sort((a, b) => a - b);
  return `dm:${unique.join(",")}`;
}

/** Encode the typing-bucket key for a channel-topic. */
export function typingChannelKey(streamId: number, topic: string): string {
  return `channel:${streamId}:${topic}`;
}

/** Per-bucket entry: the sender ids currently typing + their last-seen times. */
export interface TypingBucket {
  /** Map of senderId → last `start` event timestamp (ms). */
  senders: Record<UserId, number>;
}

export interface TypingState {
  /** Active typing per conversation. */
  buckets: Record<string, TypingBucket>;
  /**
   * Mark a sender as actively typing in `key`. Refreshes their
   * timestamp if they were already typing (the server may resend
   * `start` events while the user keeps typing).
   */
  start: (key: string, senderId: UserId, nowMs: number) => void;
  /** Drop a sender from `key`'s typing bucket. */
  stop: (key: string, senderId: UserId) => void;
  /** Evict any sender whose `lastSeenMs` is older than `nowMs - staleMs`. */
  pruneStale: (nowMs: number, staleMs?: number) => void;
  /** Sender ids currently typing in `key`, in numeric order. */
  getSenders: (key: string) => UserId[];
}

function withoutBucket(
  buckets: Record<string, TypingBucket>,
  key: string,
): Record<string, TypingBucket> {
  if (buckets[key] === undefined) {
    return buckets;
  }
  const next = { ...buckets };
  delete next[key];
  return next;
}

export const useTypingStore = create<TypingState>()((set, get) => ({
  buckets: {},
  start: (key, senderId, nowMs) => {
    set((state) => {
      const current = state.buckets[key]?.senders ?? {};
      // Already there with the same/recent timestamp — refresh to
      // current time, but only when the timestamp would actually move.
      if (current[senderId] === nowMs) {
        return state;
      }
      return {
        buckets: {
          ...state.buckets,
          [key]: { senders: { ...current, [senderId]: nowMs } },
        },
      };
    });
  },
  stop: (key, senderId) => {
    set((state) => {
      const bucket = state.buckets[key];
      if (bucket === undefined || bucket.senders[senderId] === undefined) {
        return state;
      }
      const nextSenders = { ...bucket.senders };
      delete nextSenders[senderId];
      if (Object.keys(nextSenders).length === 0) {
        return { buckets: withoutBucket(state.buckets, key) };
      }
      return {
        buckets: { ...state.buckets, [key]: { senders: nextSenders } },
      };
    });
  },
  pruneStale: (nowMs, staleMs = TYPING_STALE_AFTER_MS) => {
    set((state) => {
      const cutoff = nowMs - staleMs;
      let changed = false;
      const nextBuckets: Record<string, TypingBucket> = {};
      for (const [key, bucket] of Object.entries(state.buckets)) {
        const nextSenders: Record<UserId, number> = {};
        let bucketChanged = false;
        for (const [idStr, lastSeen] of Object.entries(bucket.senders)) {
          if (lastSeen >= cutoff) {
            nextSenders[Number(idStr)] = lastSeen;
          } else {
            bucketChanged = true;
            changed = true;
          }
        }
        if (Object.keys(nextSenders).length === 0) {
          if (!bucketChanged) {
            nextBuckets[key] = bucket;
          }
          continue;
        }
        nextBuckets[key] = bucketChanged ? { senders: nextSenders } : bucket;
      }
      if (!changed) {
        return state;
      }
      return { buckets: nextBuckets };
    });
  },
  getSenders: (key) => {
    const bucket = get().buckets[key];
    if (bucket === undefined) {
      return [];
    }
    return Object.keys(bucket.senders)
      .map((s) => Number(s))
      .sort((a, b) => a - b);
  },
}));

// Wire to the realtime layer at module load — before `start()` runs.
// The store has no hydration source: typing is a transient signal,
// register snapshots do not carry it. On every `typing` event we
// route to start/stop, suppressing the viewer's own typing (the
// server echoes our own start/stop events back via the queue).
wireStore({
  hydrate: () => {
    useTypingStore.setState({ buckets: {} });
  },
  applyEvent: (event) => {
    if (!isTypingEvent(event)) {
      return;
    }
    const ownUserId = useAuthStore.getState().session?.userId;
    if (event.sender.user_id === ownUserId) {
      return;
    }
    const key = keyForTypingEvent(event, ownUserId);
    if (key === null) {
      return;
    }
    const store = useTypingStore.getState();
    if (event.op === "start") {
      store.start(key, event.sender.user_id, Date.now());
    } else {
      store.stop(key, event.sender.user_id);
    }
  },
});

/**
 * Build the bucket key for a `typing` event. Returns `null` when the
 * event lacks the fields required for the kind (channel/topic for
 * stream typing, recipients for direct typing).
 *
 * For DMs the viewer's own id is mixed into the participant list so
 * the key matches what `getTypingFor(narrow)` builds at the consumer
 * side. The server's `recipients` for a DM typing event includes
 * every participant *other* than the sender; we add the sender back
 * in here, then add the viewer (when not already present) so a 1:1
 * `dm:5,100` key matches a 1:1 narrow `dm:[5]` from the viewer's
 * perspective.
 */
function keyForTypingEvent(
  event: import("../domain").TypingEvent,
  ownUserId: number | undefined,
): string | null {
  if (event.message_type === "stream") {
    if (event.stream_id === undefined || event.topic === undefined) {
      return null;
    }
    return typingChannelKey(event.stream_id, event.topic);
  }
  if (!Array.isArray(event.recipients)) {
    return null;
  }
  const ids = event.recipients.map((r) => r.user_id);
  ids.push(event.sender.user_id);
  if (ownUserId !== undefined) {
    ids.push(ownUserId);
  }
  return typingDmKey(ids);
}

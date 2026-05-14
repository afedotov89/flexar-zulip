// Server-state store: the full per-channel topic list (Phase 1.5a).
//
// Phase 1.5's channel rows could only show the topics that currently
// had unread messages (derived from `unreadStore`). This store holds
// the *complete* topic list for a channel, so an expanded channel in
// the left sidebar can list every topic, not just the unread ones.
//
// ── Why this store is lazy ──────────────────────────────────────────
//
// Topics are not part of the register snapshot — there is no
// `topics` initial-state key. So unlike the other server-state stores,
// this one is not hydrated at connect time. Instead a channel's topics
// are fetched on demand via `apiClient.getTopics` the first time the
// sidebar expands that channel (`loadTopics`). The fetch is cached:
// `loadTopics` is idempotent — a channel already loaded (or in flight)
// is not re-fetched. A per-channel `loadStatus` lets the UI show a
// spinner while the fetch is in flight and an error state if it fails.
//
// ── Lifecycle ───────────────────────────────────────────────────────
//
//   - re-register (`hydrate`) — the topic caches are considered stale
//     and cleared. The viewer's channel access may have changed across
//     the gap, and topic lists are cheap to re-fetch on demand; an
//     empty cache is the safe re-hydration. The sidebar re-runs
//     `loadTopics` for whichever channels are expanded.
//   - `message` events — a channel message in an *already-loaded*
//     channel folds into that channel's list (new topic inserted, or
//     an existing topic's `max_id` bumped). Channels not yet loaded are
//     left alone — their on-demand fetch will include the topic.
//
// The pure transformations live in `./topicsReducer`.
//
// No `persist`: server state is re-fetched on every connect and must
// not survive a reload as stale data.

import { create } from "zustand";
import type { StreamId, Topic } from "../domain";
import { apiClient } from "../api";
import { isMessageEvent } from "./eventGuards";
import {
  applyMessageEventToTopics,
  topicsByMaxIdDesc,
  type TopicsByChannel,
} from "./topicsReducer";
import { wireStore } from "./wireStore";

/** Load state of one channel's topic list. */
export type TopicsLoadStatus = "loading" | "loaded" | "error";

export interface TopicsState {
  /** Per-channel topic lists, keyed by channel id. Empty until loaded. */
  topicsByChannel: TopicsByChannel;
  /** Per-channel load status; absent means "not requested yet". */
  loadStatus: Record<StreamId, TopicsLoadStatus>;
  /**
   * Fetch and cache one channel's topics. Idempotent: a channel that is
   * already loaded or has a fetch in flight is not re-fetched. After a
   * failed fetch the channel's status is `"error"` and calling again
   * retries.
   */
  loadTopics: (streamId: StreamId) => Promise<void>;
  /** A channel's topics (most-recent-first), or `[]` if not loaded. */
  getTopics: (streamId: StreamId) => Topic[];
  /** A channel's load status, or `undefined` if never requested. */
  getLoadStatus: (streamId: StreamId) => TopicsLoadStatus | undefined;
}

const EMPTY_TOPICS: Topic[] = [];

export const useTopicsStore = create<TopicsState>()((set, get) => ({
  topicsByChannel: {},
  loadStatus: {},
  loadTopics: async (streamId) => {
    const status = get().loadStatus[streamId];
    // Already loaded, or a fetch is already in flight — nothing to do.
    if (status === "loaded" || status === "loading") {
      return;
    }
    set((state) => ({
      loadStatus: { ...state.loadStatus, [streamId]: "loading" },
    }));
    try {
      const topics = await apiClient.getTopics(streamId);
      set((state) => ({
        topicsByChannel: {
          ...state.topicsByChannel,
          [streamId]: topicsByMaxIdDesc(topics),
        },
        loadStatus: { ...state.loadStatus, [streamId]: "loaded" },
      }));
    } catch {
      set((state) => ({
        loadStatus: { ...state.loadStatus, [streamId]: "error" },
      }));
    }
  },
  getTopics: (streamId) => get().topicsByChannel[streamId] ?? EMPTY_TOPICS,
  getLoadStatus: (streamId) => get().loadStatus[streamId],
}));

// Wire to the realtime layer at module load — before `start()` runs.
wireStore({
  hydrate: () => {
    // Topics are not in the register snapshot; a re-register makes the
    // caches stale (see the file header), so reset to empty. Expanded
    // channels in the sidebar re-run `loadTopics`.
    useTopicsStore.setState({ topicsByChannel: {}, loadStatus: {} });
  },
  applyEvent: (event) => {
    if (!isMessageEvent(event)) {
      return;
    }
    useTopicsStore.setState((state) => ({
      topicsByChannel: applyMessageEventToTopics(
        state.topicsByChannel,
        event,
      ),
    }));
  },
});

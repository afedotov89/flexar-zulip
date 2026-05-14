// Pure reducers for the topics store (Phase 1.5a).
//
// The topics store holds the full per-channel topic list — every topic
// the viewer can see in a channel, not just the ones with unread
// messages. Topics are *not* part of the register snapshot, so the
// store is populated lazily by `apiClient.getTopics` (see
// `topicsStore`). What this module owns are the pure transformations:
//
//   - `topicsByMaxIdDesc` — the canonical order: most recent topic
//     first, matching the order `GET .../topics` returns.
//   - `applyMessageEventToTopics` — folds a `message` event into a
//     *loaded* channel's topic list. A channel message either bumps an
//     existing topic's `max_id` (re-sorting it toward the front) or
//     introduces a new topic. Channels that have not been loaded yet
//     are left untouched — their list is fetched fresh on demand and
//     will already include the new topic.
//
// All reducers are pure: they return new structures and never mutate
// their inputs.

import type { MessageEvent, StreamId, Topic } from "../domain";

/** Per-channel topic lists, keyed by channel id. */
export type TopicsByChannel = Record<StreamId, Topic[]>;

/**
 * Sort topics most-recent-first by `max_id`. This is the order the
 * `GET /users/me/{stream_id}/topics` endpoint returns, and the order
 * the sidebar renders.
 */
export function topicsByMaxIdDesc(topics: readonly Topic[]): Topic[] {
  return [...topics].sort((a, b) => b.max_id - a.max_id);
}

/**
 * Fold a `message` event into the per-channel topic lists. Only channel
 * messages in an *already-loaded* channel matter: the message's topic
 * either gets its `max_id` bumped (and the list re-sorted) or, if new,
 * is inserted. A message in a channel whose topics have not been loaded
 * is ignored — the lazy fetch will include the topic when it runs.
 * Returns a new map; the input is never mutated. Same reference when
 * nothing changed.
 */
export function applyMessageEventToTopics(
  topicsByChannel: TopicsByChannel,
  event: MessageEvent,
): TopicsByChannel {
  const { message } = event;
  if (message.type !== "stream" || message.stream_id === undefined) {
    return topicsByChannel;
  }
  const streamId = message.stream_id;
  const existing = topicsByChannel[streamId];
  // Channel not loaded yet: leave it for the on-demand fetch.
  if (existing === undefined) {
    return topicsByChannel;
  }

  const topicName = message.subject;
  const current = existing.find((topic) => topic.name === topicName);
  // A message can only raise a topic's `max_id`, never lower it; an
  // out-of-order delivery that does not advance it is a no-op.
  if (current !== undefined && current.max_id >= message.id) {
    return topicsByChannel;
  }

  const others = existing.filter((topic) => topic.name !== topicName);
  const nextTopics = topicsByMaxIdDesc([
    ...others,
    { name: topicName, max_id: message.id },
  ]);
  return { ...topicsByChannel, [streamId]: nextTopics };
}

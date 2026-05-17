// Pure reducers for the streams/subscriptions store (Phase 1.3).
//
// The store holds two keyed collections:
//
//   - `streams`        — every channel visible to the user, keyed by
//                        `stream_id`. The channel *metadata* layer.
//   - `subscriptions`  — the channels the user is currently subscribed
//                        to, keyed by `stream_id`, carrying the user's
//                        personal per-channel settings (color, mute,
//                        notification overrides).
//
// A subscribed channel appears in *both* maps: `streams` for its
// org-level metadata, `subscriptions` for the viewer's personal view.
//
// Register snapshot keys (all gated on `subscription` / `stream` in
// `fetch_event_types`):
//   - `streams`          → all visible channels (`Stream` shape).
//   - `never_subscribed` → visible channels never subscribed to
//                          (`Stream` shape); folded into `streams`.
//   - `subscriptions`    → current subscriptions (`Subscription`).
//   - `unsubscribed`     → previously-subscribed, now-unsubscribed
//                          channels (`Subscription` shape). Their
//                          channel metadata is folded into `streams`;
//                          they are *not* current subscriptions, so
//                          they do not go in `subscriptions`.
//
// Events:
//   - `stream` create/delete/update — channel metadata lifecycle.
//   - `subscription` add/remove/update — the viewer's own
//     subscriptions; `peer_add`/`peer_remove` adjust `subscriber_count`
//     on the affected channels.
//
// All reducers are pure: they return new records and never mutate the
// inputs.

import type {
  Stream,
  StreamEvent,
  StreamId,
  Subscription,
  SubscriptionEvent,
  UserId,
} from "../domain";
import type { InitialState } from "../realtime";

/** Every visible channel, keyed by `stream_id`. */
export type StreamMap = Record<StreamId, Stream>;
/** The viewer's current subscriptions, keyed by `stream_id`. */
export type SubscriptionMap = Record<StreamId, Subscription>;

/** The streams store's full keyed state. */
export interface StreamsSnapshot {
  streams: StreamMap;
  subscriptions: SubscriptionMap;
}

/** Index an array of channel-like objects into a record by `stream_id`. */
function byStreamId<T extends { stream_id: StreamId }>(
  items: readonly T[],
): Record<StreamId, T> {
  const map: Record<StreamId, T> = {};
  for (const item of items) {
    map[item.stream_id] = item;
  }
  return map;
}

/**
 * Build the streams + subscriptions state from a register snapshot.
 * Missing keys (a narrower `fetch_event_types`) are treated as empty.
 *
 * `streams`, `never_subscribed`, and the channel side of `unsubscribed`
 * all populate the `streams` map; only `subscriptions` populates the
 * `subscriptions` map.
 */
export function streamsFromInitialState(
  state: InitialState,
): StreamsSnapshot {
  const allStreams = Array.isArray(state.streams)
    ? (state.streams as Stream[])
    : [];
  const neverSubscribed = Array.isArray(state.never_subscribed)
    ? (state.never_subscribed as Stream[])
    : [];
  const subscriptions = Array.isArray(state.subscriptions)
    ? (state.subscriptions as Subscription[])
    : [];
  const unsubscribed = Array.isArray(state.unsubscribed)
    ? (state.unsubscribed as Subscription[])
    : [];

  // Every channel object the snapshot mentions, by id, contributes its
  // metadata to `streams`. `Subscription` extends the channel base, so
  // a subscription doubles as channel metadata.
  const streams: StreamMap = {
    ...byStreamId(allStreams),
    ...byStreamId(neverSubscribed),
    ...byStreamId(unsubscribed as unknown as Stream[]),
    ...byStreamId(subscriptions as unknown as Stream[]),
  };

  return {
    streams,
    subscriptions: byStreamId(subscriptions),
  };
}

/**
 * Fold one `stream` event into the channel-metadata map. Returns a new
 * map; the input is never mutated.
 *
 *   - `create` — add the new channels.
 *   - `delete` — drop the channels (archived / lost visibility).
 *   - `update` — shallow-merge the changed property onto the channel.
 *
 * An `update` for an unknown channel is a no-op: the event raced ahead
 * of a `streams` map a narrower `fetch_event_types` left incomplete.
 */
export function applyStreamEvent(
  streams: StreamMap,
  event: StreamEvent,
): StreamMap {
  switch (event.op) {
    case "create": {
      const next = { ...streams };
      for (const stream of event.streams) {
        next[stream.stream_id] = stream;
      }
      return next;
    }
    case "delete": {
      let changed = false;
      const next = { ...streams };
      for (const stream of event.streams) {
        if (stream.stream_id in next) {
          delete next[stream.stream_id];
          changed = true;
        }
      }
      return changed ? next : streams;
    }
    case "update": {
      const existing = streams[event.stream_id];
      if (existing === undefined) {
        return streams;
      }
      return {
        ...streams,
        [event.stream_id]: { ...existing, [event.property]: event.value },
      };
    }
  }
}

/**
 * Fold one `subscription` event into the streams state. Returns a new
 * `StreamsSnapshot`; inputs are never mutated.
 *
 *   - `add`         — the viewer subscribed to channels; each carries a
 *                     full `Subscription`. The subscription also
 *                     refreshes the channel's metadata in `streams`.
 *   - `remove`      — the viewer unsubscribed; drop from
 *                     `subscriptions`. The channel stays in `streams`:
 *                     it is still visible, just not subscribed.
 *   - `update`      — a personal property of one subscription changed
 *                     (color, mute, …); shallow-merge it.
 *   - `peer_add` /
 *     `peer_remove` — other users (de)subscribed; adjust
 *                     `subscriber_count` on the affected channels in
 *                     both maps. Clamped at 0.
 */
export function applySubscriptionEvent(
  snapshot: StreamsSnapshot,
  event: SubscriptionEvent,
): StreamsSnapshot {
  switch (event.op) {
    case "add": {
      const subscriptions = { ...snapshot.subscriptions };
      const streams = { ...snapshot.streams };
      for (const sub of event.subscriptions) {
        subscriptions[sub.stream_id] = sub;
        // A `Subscription` carries the full channel base, so it also
        // refreshes (or introduces) the channel's metadata.
        streams[sub.stream_id] = sub as unknown as Stream;
      }
      return { streams, subscriptions };
    }
    case "remove": {
      let changed = false;
      const subscriptions = { ...snapshot.subscriptions };
      for (const { stream_id } of event.subscriptions) {
        if (stream_id in subscriptions) {
          delete subscriptions[stream_id];
          changed = true;
        }
      }
      // The channel itself stays in `streams` — still visible, just
      // no longer subscribed.
      return changed ? { ...snapshot, subscriptions } : snapshot;
    }
    case "update": {
      const existing = snapshot.subscriptions[event.stream_id];
      if (existing === undefined) {
        return snapshot;
      }
      return {
        ...snapshot,
        subscriptions: {
          ...snapshot.subscriptions,
          [event.stream_id]: {
            ...existing,
            [event.property]: event.value,
          },
        },
      };
    }
    case "peer_add":
    case "peer_remove": {
      // Keep both the count AND the actual subscriber list in sync.
      // The count drives sidebar badges; the list drives the right
      // sidebar's "В этом канале" pane. The two folds compose — count
      // first, then mutate the subscribers array on each affected sub.
      const delta = event.op === "peer_add" ? 1 : -1;
      const count = event.user_ids.length;
      const withCount = adjustSubscriberCount(
        snapshot,
        event.stream_ids,
        delta * count,
      );
      return adjustSubscriberList(
        withCount,
        event.stream_ids,
        event.user_ids,
        event.op,
      );
    }
  }
}

/**
 * Add or remove `userIds` from the subscriber arrays of every
 * affected subscription. Both `subscribers` (full list, returned on
 * normal-sized channels) and `partial_subscribers` (sampled list,
 * returned on very large channels) are kept in sync — the right
 * sidebar reads `subscribers ?? partial_subscribers`, so missing
 * an update on the one that the snapshot happens to use would
 * leave the members pane drifting. Channels the viewer is not
 * subscribed to have no lists to maintain at all and are skipped.
 *
 * Idempotent on both ends: an already-listed user is not duplicated
 * on `peer_add`; a missing user is not flagged on `peer_remove`.
 */
function adjustSubscriberList(
  snapshot: StreamsSnapshot,
  streamIds: readonly StreamId[],
  userIds: readonly UserId[],
  op: "peer_add" | "peer_remove",
): StreamsSnapshot {
  if (streamIds.length === 0 || userIds.length === 0) {
    return snapshot;
  }
  let changed = false;
  const subscriptions = { ...snapshot.subscriptions };
  for (const streamId of streamIds) {
    const sub = subscriptions[streamId];
    if (sub === undefined) {
      continue;
    }
    const nextSubscribers = updateIdList(sub.subscribers, userIds, op);
    const nextPartial = updateIdList(sub.partial_subscribers, userIds, op);
    if (
      nextSubscribers === sub.subscribers &&
      nextPartial === sub.partial_subscribers
    ) {
      continue;
    }
    subscriptions[streamId] = {
      ...sub,
      subscribers: nextSubscribers,
      partial_subscribers: nextPartial,
    };
    changed = true;
  }
  return changed ? { ...snapshot, subscriptions } : snapshot;
}

/**
 * Apply a peer add/remove to one of the subscriber arrays. Returns
 * the original reference unchanged when the list is undefined or the
 * change is a no-op (so the caller can compare by identity).
 */
function updateIdList(
  list: UserId[] | undefined,
  userIds: readonly UserId[],
  op: "peer_add" | "peer_remove",
): UserId[] | undefined {
  if (list === undefined) {
    return undefined;
  }
  if (op === "peer_add") {
    const additions = userIds.filter((id) => !list.includes(id));
    if (additions.length === 0) {
      return list;
    }
    return [...list, ...additions];
  }
  const dropping = new Set<UserId>(userIds);
  const next = list.filter((id) => !dropping.has(id));
  return next.length === list.length ? list : next;
}

/**
 * Add `delta` to the `subscriber_count` of every channel in
 * `streamIds`, in both `streams` and `subscriptions`. Counts are
 * clamped at 0. Returns the original snapshot if nothing changed.
 */
function adjustSubscriberCount(
  snapshot: StreamsSnapshot,
  streamIds: readonly StreamId[],
  delta: number,
): StreamsSnapshot {
  if (delta === 0 || streamIds.length === 0) {
    return snapshot;
  }
  let changed = false;
  const streams = { ...snapshot.streams };
  const subscriptions = { ...snapshot.subscriptions };
  for (const streamId of streamIds) {
    const stream = streams[streamId];
    if (stream !== undefined) {
      streams[streamId] = {
        ...stream,
        subscriber_count: Math.max(0, stream.subscriber_count + delta),
      };
      changed = true;
    }
    const sub = subscriptions[streamId];
    if (sub !== undefined) {
      subscriptions[streamId] = {
        ...sub,
        subscriber_count: Math.max(0, sub.subscriber_count + delta),
      };
      changed = true;
    }
  }
  return changed ? { streams, subscriptions } : snapshot;
}

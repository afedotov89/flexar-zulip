// Pure reducers for the scheduled-messages store (Phase 4.5).
//
// The server-side scheduled-message lifecycle:
//
//   1. `POST /scheduled_messages` → server emits a
//      `scheduled_messages add` event back through the queue.
//   2. `PATCH /scheduled_messages/{id}` → `scheduled_messages update`.
//   3. `DELETE /scheduled_messages/{id}` → `scheduled_messages remove`.
//   4. When the server actually sends the message (or gives up after
//      a final failure), it emits another `remove` event with the
//      record's `scheduled_message_id`.
//
// The store hydrates from `GET /scheduled_messages` (a fetch the store
// triggers on first hydration — the `register` snapshot does not
// include scheduled messages) and folds the realtime stream on top.
// All reducers are pure, take a `Record<id, ScheduledMessage>` map and
// return a new map; the store wraps them with `set`.
//
// The list view sorts the bag by `scheduled_delivery_timestamp`
// ascending (the same order the server returns from
// `GET /scheduled_messages`); ties are broken by id so the order is
// deterministic for snapshot tests.

import type { ScheduledMessage } from "../domain";

/** All scheduled messages, keyed by `scheduled_message_id`. */
export type ScheduledMessageMap = Record<number, ScheduledMessage>;

/** Replace the bag with the snapshot from a fetch. */
export function replaceAll(messages: readonly ScheduledMessage[]): ScheduledMessageMap {
  const next: ScheduledMessageMap = {};
  for (const message of messages) {
    next[message.scheduled_message_id] = message;
  }
  return next;
}

/**
 * Insert one or more scheduled messages. Existing entries with the
 * same id are overwritten — `add` events do not race with `update`
 * events, but the optimistic create path may have inserted a
 * placeholder under a known id which the realtime echo then refines.
 */
export function applyAdd(
  state: ScheduledMessageMap,
  added: readonly ScheduledMessage[],
): ScheduledMessageMap {
  if (added.length === 0) {
    return state;
  }
  const next: ScheduledMessageMap = { ...state };
  for (const message of added) {
    next[message.scheduled_message_id] = message;
  }
  return next;
}

/**
 * Replace one scheduled message in the bag with its updated record.
 * No-op when the id is unknown.
 */
export function applyUpdate(
  state: ScheduledMessageMap,
  updated: ScheduledMessage,
): ScheduledMessageMap {
  if (state[updated.scheduled_message_id] === undefined) {
    return state;
  }
  return { ...state, [updated.scheduled_message_id]: updated };
}

/**
 * Remove one scheduled message by id. No-op (returns the same
 * reference) when the id is unknown.
 */
export function applyRemove(
  state: ScheduledMessageMap,
  scheduledMessageId: number,
): ScheduledMessageMap {
  if (state[scheduledMessageId] === undefined) {
    return state;
  }
  const next = { ...state };
  delete next[scheduledMessageId];
  return next;
}

/**
 * Snapshot the bag as a list, sorted by `scheduled_delivery_timestamp`
 * ascending and then by id so ties break deterministically.
 */
export function listScheduled(state: ScheduledMessageMap): ScheduledMessage[] {
  return Object.values(state).sort((a, b) => {
    if (a.scheduled_delivery_timestamp !== b.scheduled_delivery_timestamp) {
      return a.scheduled_delivery_timestamp - b.scheduled_delivery_timestamp;
    }
    return a.scheduled_message_id - b.scheduled_message_id;
  });
}

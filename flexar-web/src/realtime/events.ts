// Pure event-stream helpers for the realtime long-poll loop.
//
// `GET /events` returns an ordered batch of `ServerEvent`s. Two pieces
// of bookkeeping the loop does on every batch are pure functions of the
// batch and belong here, unit-tested, away from the timer/transport
// machinery in `connection.ts`:
//
//   - advancing `last_event_id` to the highest id seen, so the next
//     poll acknowledges everything received (heartbeats included);
//   - splitting heartbeats out of the batch — they keep the queue alive
//     and advance the id, but carry no state and must not reach
//     downstream consumers.

import type { ServerEvent } from "../domain";

/**
 * The highest event id in `events`, or `current` when the batch is
 * empty. Event ids are monotonically increasing but not necessarily
 * consecutive (see `EventBase`), so the loop tracks the max rather than
 * assuming the last element is the newest. Never moves `last_event_id`
 * backwards.
 */
export function maxEventId(events: readonly ServerEvent[], current: number): number {
  let max = current;
  for (const event of events) {
    if (event.id > max) {
      max = event.id;
    }
  }
  return max;
}

/** Whether an event is a queue keepalive rather than real state. */
export function isHeartbeat(event: ServerEvent): boolean {
  return event.type === "heartbeat";
}

/**
 * Drop heartbeat events from a batch. The dropped heartbeats still
 * advance `last_event_id` (see `maxEventId`) — they just carry no
 * payload for subscribers, so they are filtered before dispatch.
 */
export function dropHeartbeats(
  events: readonly ServerEvent[],
): ServerEvent[] {
  return events.filter((event) => !isHeartbeat(event));
}

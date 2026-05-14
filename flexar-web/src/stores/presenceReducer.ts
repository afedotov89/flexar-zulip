// Pure reducers for the presence store (Phase 1.3).
//
// Presence is a map from `user_id` to that user's modern-format
// `Presence` (two timestamps the UI compares against the current time
// to render an availability dot).
//
// The realtime connection registers with `slimPresence: true`, so the
// register snapshot's `presences` key is already in the modern
// keyed-by-id format the domain `PresenceMap` models — hydration is a
// direct projection.
//
// `presence` *events*, however, can arrive in either format. The
// connection does not declare the `simplified_presence_events` client
// capability, so the server may send the legacy shape
// (`user_id` + `presence` keyed by client name). `applyPresenceEvent`
// handles both:
//   - modern: `event.presences` is a `PresenceMap` — merge it in.
//   - legacy: `event.user_id` + `event.presence` — the domain types
//     `event.presence` as `Record<string, Presence>` (per-client
//     `Presence` records). We collapse those into one `Presence` by
//     taking the newest timestamp seen across the per-client records.
//
// NOTE for the orchestrator: the domain `PresenceEvent.presence` field
// is typed `Record<string, Presence>`, but Zulip's actual legacy
// presence wire format keys by client name with
// `{ client, status, timestamp, pushable }` records — not `Presence`
// objects. This reducer follows the *domain type* (the frozen
// contract), not the raw wire shape; if the legacy format matters in
// practice, the precise event type needs revisiting through the
// orchestrator. In practice the connection requests `slimPresence` and
// can additionally declare `simplified_presence_events` to receive
// only the modern format, sidestepping this entirely.
//
// Reducers are pure: they return a new map and never mutate the input.

import type { Presence, PresenceEvent, PresenceMap } from "../domain";
import type { InitialState } from "../realtime";

/**
 * Build the presence map from a register snapshot's `presences` key.
 * Returns an empty map when the snapshot has no `presences` (its
 * `fetch_event_types` did not request `presence`). With
 * `slimPresence: true` the key is already a modern `PresenceMap`.
 */
export function presenceFromInitialState(state: InitialState): PresenceMap {
  const presences = state.presences;
  if (presences == null || typeof presences !== "object") {
    return {};
  }
  // `slimPresence: true` guarantees the modern keyed-by-id shape.
  return { ...(presences as PresenceMap) };
}

/**
 * Collapse the per-client records of a legacy `presence` event into one
 * modern `Presence`. The domain types each per-client record as a
 * `Presence`; we take the newest `active_timestamp` and the newest
 * `idle_timestamp` seen across all the client records.
 */
function legacyPresenceToModern(
  perClient: Record<string, Presence>,
): Presence {
  let active: number | undefined;
  let idle: number | undefined;
  for (const entry of Object.values(perClient)) {
    if (
      entry.active_timestamp !== undefined &&
      (active === undefined || entry.active_timestamp > active)
    ) {
      active = entry.active_timestamp;
    }
    if (
      entry.idle_timestamp !== undefined &&
      (idle === undefined || entry.idle_timestamp > idle)
    ) {
      idle = entry.idle_timestamp;
    }
  }
  const collapsed: Presence = {};
  if (active !== undefined) {
    collapsed.active_timestamp = active;
  }
  if (idle !== undefined) {
    collapsed.idle_timestamp = idle;
  }
  return collapsed;
}

/**
 * Fold one `presence` event into the presence map. Returns a new map;
 * the input is never mutated. Handles both the modern (`presences`)
 * and legacy (`user_id` + `presence`) event shapes. A malformed event
 * carrying neither shape is a no-op.
 */
export function applyPresenceEvent(
  presence: PresenceMap,
  event: PresenceEvent,
): PresenceMap {
  // Modern format: a ready-made `PresenceMap` to merge in.
  if (event.presences != null) {
    return { ...presence, ...event.presences };
  }
  // Legacy format: a single user's per-client records.
  if (event.user_id != null && event.presence != null) {
    return {
      ...presence,
      [event.user_id]: legacyPresenceToModern(event.presence),
    };
  }
  // Neither shape present — nothing to apply.
  return presence;
}

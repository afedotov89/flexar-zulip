// Presence freshness (Phase 1.5; promoted to `src/lib` in Phase 1.8).
//
// The presence store keeps each user's newest `active_timestamp` /
// `idle_timestamp` (see `presenceReducer`). The sidebars only need a
// coarse three-state answer for the presence dot, so this pure helper
// collapses the two timestamps against the current time.
//
// Thresholds mirror Zulip's own presence model: a user is "active" if
// they interacted within `ACTIVE_THRESHOLD_SECONDS`, "idle" if some
// client of theirs was merely connected within `IDLE_THRESHOLD_SECONDS`,
// and "offline" otherwise. Kept as a pure function of `(presence, now)`
// so it is trivially unit-testable without mocking the clock.

import type { Presence } from "../domain";

/** Coarse presence state for the sidebars' per-user dot. */
export type PresenceStatus = "active" | "idle" | "offline";

/** A recent `active_timestamp` within this many seconds means "active". */
export const ACTIVE_THRESHOLD_SECONDS = 140;

/** A recent `idle_timestamp` within this many seconds means "idle". */
export const IDLE_THRESHOLD_SECONDS = 140;

/**
 * Collapse a user's `Presence` into a coarse status, relative to `now`
 * (a Unix timestamp in seconds). An absent presence is `"offline"`.
 */
export function presenceStatus(
  presence: Presence | undefined,
  now: number,
): PresenceStatus {
  if (presence === undefined) {
    return "offline";
  }
  const { active_timestamp, idle_timestamp } = presence;
  if (
    active_timestamp !== undefined &&
    now - active_timestamp <= ACTIVE_THRESHOLD_SECONDS
  ) {
    return "active";
  }
  if (
    idle_timestamp !== undefined &&
    now - idle_timestamp <= IDLE_THRESHOLD_SECONDS
  ) {
    return "idle";
  }
  return "offline";
}

// Pure reducers for the user-statuses store (Phase 4.4).
//
// `UserStatus` is a per-user status line: optional text, optional
// emoji. The server maintains it as a sparse map (only users who set
// a status are listed) and broadcasts changes via `user_status`
// events. The reducers fold those events into the bag, treating an
// "all-empty" status as a clear (drop the user from the map).
//
// The realtime event shape uses the wire-empty-string convention to
// signal "clear this field". `applyUserStatusEvent` handles the
// merge by starting from the existing status, applying the event's
// non-undefined fields, and then dropping any empty-string field.

import type { UnknownEvent, UserStatus, UserStatusEvent } from "../domain";

/** All set user statuses, keyed by user id. */
export type UserStatusMap = Record<number, UserStatus>;

/** Replace the bag with a register-snapshot map. */
export function hydrateFromSnapshot(
  snapshot: Record<string, UserStatus>,
): UserStatusMap {
  const next: UserStatusMap = {};
  for (const [userIdStr, status] of Object.entries(snapshot)) {
    const userId = Number(userIdStr);
    if (!Number.isInteger(userId) || isStatusEffectivelyEmpty(status)) {
      continue;
    }
    next[userId] = pruneEmptyFields(status);
  }
  return next;
}

/**
 * Fold one `user_status` event into the bag. Empty-string fields in
 * the event clear the corresponding piece; an event that leaves the
 * user with no status text and no status emoji drops them from the
 * bag entirely.
 */
export function applyUserStatusEvent(
  state: UserStatusMap,
  event: UserStatusEvent | (UnknownEvent & { user_id?: number }),
): UserStatusMap {
  if (event.type !== "user_status") {
    return state;
  }
  const userId = (event as UserStatusEvent).user_id;
  if (typeof userId !== "number" || !Number.isInteger(userId)) {
    return state;
  }
  const current = state[userId] ?? {};
  const merged: UserStatus = {
    ...current,
    ...mergeEventFields(event as UserStatusEvent),
  };
  const cleaned = pruneEmptyFields(merged);
  if (isStatusEffectivelyEmpty(cleaned)) {
    if (!(userId in state)) {
      return state;
    }
    const next = { ...state };
    delete next[userId];
    return next;
  }
  return { ...state, [userId]: cleaned };
}

/** Apply only the `user_status` event fields the server actually sent. */
function mergeEventFields(event: UserStatusEvent): Partial<UserStatus> {
  const next: Partial<UserStatus> = {};
  if (event.status_text !== undefined) {
    next.status_text = event.status_text;
  }
  if (event.emoji_name !== undefined) {
    next.emoji_name = event.emoji_name;
  }
  if (event.emoji_code !== undefined) {
    next.emoji_code = event.emoji_code;
  }
  if (event.reaction_type !== undefined) {
    next.reaction_type = event.reaction_type;
  }
  if (event.away !== undefined) {
    next.away = event.away;
  }
  return next;
}

/** Drop any string field whose value is `""` — the wire-clear signal. */
function pruneEmptyFields(status: UserStatus): UserStatus {
  const next: UserStatus = {};
  if (status.status_text !== undefined && status.status_text !== "") {
    next.status_text = status.status_text;
  }
  if (status.emoji_name !== undefined && status.emoji_name !== "") {
    next.emoji_name = status.emoji_name;
  }
  if (status.emoji_code !== undefined && status.emoji_code !== "") {
    next.emoji_code = status.emoji_code;
  }
  if (status.reaction_type !== undefined && status.reaction_type !== "") {
    next.reaction_type = status.reaction_type;
  }
  if (status.away !== undefined) {
    next.away = status.away;
  }
  return next;
}

/** A status with no text and no emoji carries no signal worth keeping. */
function isStatusEffectivelyEmpty(status: UserStatus): boolean {
  const hasText =
    status.status_text !== undefined && status.status_text !== "";
  const hasEmoji =
    (status.emoji_name !== undefined && status.emoji_name !== "") ||
    (status.emoji_code !== undefined && status.emoji_code !== "");
  return !hasText && !hasEmoji;
}

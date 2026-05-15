// Flexar Hub Web — when does a `message` event warrant a notification?
// (Phase 3.5)
//
// Pure decision function — no side effects, no DOM, no audio. Lives in
// `src/lib/` so the dispatcher (`src/features/notifications/`) and the
// tests can both import it without dragging in any UI surface.
//
// Rules (mirroring how Zulip's own clients decide):
//
//   1. The viewer never gets a notification for their own messages
//      (suppressed even if the message is addressed to themselves —
//      e.g. a self-DM).
//   2. A message carrying the `mentioned`, `wildcard_mentioned` or
//      `topic_wildcard_mentioned` flag is always a mention notification.
//   3. A direct message addressed to the viewer is always a notification.
//   4. Channel messages without a mention flag are not notified.
//      (Channel "everything" notifications are an org / per-channel
//      preference Zulip exposes through its settings; we do not yet
//      thread that through, and a frequent client would be the wrong
//      default for a chat-app.)
//
// The active narrow / tab-visibility gate (do-not-notify when the user
// is already looking at this conversation) lives at the dispatcher
// layer — see `notificationDispatcher`. Keeping it out of this pure
// helper makes "should this kind of message ever notify?" easy to
// unit-test without faking the whole UI state.

import type {
  Message,
  MessageFlag,
  UserId,
} from "../../domain";

export type NotificationKind = "mention" | "dm";

export interface NotificationTrigger {
  /** Why we are notifying — mention / DM. Drives the message sound + body. */
  kind: NotificationKind;
}

/**
 * Decide whether a freshly received message warrants a notification.
 * Returns the trigger reason, or `null` if no notification should fire.
 *
 * `ownUserId` is the viewer's id; pass `null` when the session has
 * not resolved yet (the function then suppresses notifications, since
 * we cannot tell the viewer's own messages from someone else's).
 */
export function notificationTriggerFor(
  message: Message,
  flags: readonly MessageFlag[],
  ownUserId: UserId | null,
): NotificationTrigger | null {
  if (ownUserId === null) {
    return null;
  }
  // Rule 1: viewer's own messages never notify.
  if (message.sender_id === ownUserId) {
    return null;
  }
  // Rule 2: mentions (personal, stream-wildcard, topic-wildcard).
  // `wildcard_mentioned` is the deprecated catch-all kept for older
  // server compatibility — the modern ones are the per-scope flags.
  if (
    flags.includes("mentioned") ||
    flags.includes("wildcard_mentioned") ||
    flags.includes("stream_wildcard_mentioned") ||
    flags.includes("topic_wildcard_mentioned")
  ) {
    return { kind: "mention" };
  }
  // Rule 3: direct messages addressed to the viewer.
  if (message.type === "private") {
    return { kind: "dm" };
  }
  return null;
}

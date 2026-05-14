// Pure reducers for the unread store (Phase 1.3).
//
// The unread store tracks which message ids the current user has not
// read. The register snapshot's `unread_msgs` key carries the unread
// state as a set of structured buckets (one-on-one DMs, channels, group
// DMs, mentions); we flatten those buckets into a single flat set of
// unread message ids — `UnreadSet`, a `Record<MessageId, true>` — which
// is the shape the event reducers can maintain incrementally and the
// read-path UI can test membership against cheaply.
//
// `unread_msgs` is an API-envelope shape, not a domain entity, and is
// not modelled in `src/domain` (the domain `events.ts` deliberately
// stops at the core chat events). It is described locally here, mirror-
// ing the `register` response in `zerver/openapi/zulip.yaml`. This is
// flagged for the orchestrator.
//
// How events move the set:
//   - `message`              — a newly received message is unread,
//                              *unless* the viewer sent it or it
//                              already carries the `read` flag.
//   - `update_message_flags` — `read` flag: `add` marks ids read
//                              (remove from set), `remove` marks them
//                              unread again (add to set). `add` with
//                              `all: true` clears the whole set. Flags
//                              other than `read` are ignored here.
//   - `delete_message`       — a deleted message can no longer be
//                              unread; drop its id.
//
// All reducers are pure: they return a new set and never mutate inputs.

import type {
  DeleteMessageEvent,
  MessageEvent,
  MessageId,
  UpdateMessageFlagsEvent,
  UserId,
} from "../domain";
import type { InitialState } from "../realtime";

/** The set of unread message ids — membership-tested by the read path. */
export type UnreadSet = Record<MessageId, true>;

/**
 * The `unread_msgs` envelope from the register response. Only the
 * fields needed to flatten out every unread message id are modelled;
 * the buckets all ultimately carry an `unread_message_ids` array.
 */
interface UnreadMsgsEnvelope {
  pms?: Array<{ unread_message_ids: MessageId[] }>;
  streams?: Array<{ unread_message_ids: MessageId[] }>;
  huddles?: Array<{ unread_message_ids: MessageId[] }>;
  /** `mentions` is a flat id array, not a bucket list. */
  mentions?: MessageId[];
}

/**
 * Flatten a register snapshot's `unread_msgs` buckets into a flat set
 * of unread message ids. Returns an empty set when the snapshot has no
 * `unread_msgs` key (its `event_types` did not include both `message`
 * and `update_message_flags`).
 *
 * `mentions` ids are a subset of the per-conversation buckets, so
 * including them is harmless — the set de-duplicates.
 */
export function unreadFromInitialState(state: InitialState): UnreadSet {
  const raw = state.unread_msgs;
  if (raw == null || typeof raw !== "object") {
    return {};
  }
  const envelope = raw as UnreadMsgsEnvelope;
  const unread: UnreadSet = {};
  const buckets = [
    envelope.pms,
    envelope.streams,
    envelope.huddles,
  ];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) {
      continue;
    }
    for (const conversation of bucket) {
      for (const id of conversation.unread_message_ids) {
        unread[id] = true;
      }
    }
  }
  if (Array.isArray(envelope.mentions)) {
    for (const id of envelope.mentions) {
      unread[id] = true;
    }
  }
  return unread;
}

/**
 * Fold a `message` event into the unread set. A freshly received
 * message is unread unless the current user sent it (senders have
 * implicitly read their own messages) or the server already attached
 * the `read` flag. Returns a new set; the input is never mutated.
 *
 * `ownUserId` is the viewer's user id; pass `null` when it is not yet
 * known (the message is then treated as unread, which the next
 * `update_message_flags`/snapshot corrects).
 */
export function applyMessageEventToUnread(
  unread: UnreadSet,
  event: MessageEvent,
  ownUserId: UserId | null,
): UnreadSet {
  const { message } = event;
  if (message.sender_id === ownUserId || event.flags.includes("read")) {
    return unread;
  }
  if (unread[message.id] === true) {
    return unread;
  }
  return { ...unread, [message.id]: true };
}

/**
 * Fold an `update_message_flags` event into the unread set. Only the
 * `read` flag is relevant: marking messages read removes them from the
 * set, un-marking adds them back. `op: "add"` with `all: true` clears
 * the entire set. Returns a new set; the input is never mutated.
 */
export function applyUpdateMessageFlagsEventToUnread(
  unread: UnreadSet,
  event: UpdateMessageFlagsEvent,
): UnreadSet {
  if (event.flag !== "read") {
    return unread;
  }
  if (event.op === "add") {
    if (event.all) {
      // Every message was marked read.
      return {};
    }
    let changed = false;
    const next = { ...unread };
    for (const id of event.messages) {
      if (id in next) {
        delete next[id];
        changed = true;
      }
    }
    return changed ? next : unread;
  }
  // `op: "remove"` — messages were marked unread again.
  let changed = false;
  const next = { ...unread };
  for (const id of event.messages) {
    if (next[id] !== true) {
      next[id] = true;
      changed = true;
    }
  }
  return changed ? next : unread;
}

/**
 * The set of message ids a `delete_message` event refers to:
 * `message_ids` for bulk-capable clients, the singular `message_id`
 * otherwise.
 */
function deletedIds(event: DeleteMessageEvent): MessageId[] {
  if (event.message_ids !== undefined) {
    return event.message_ids;
  }
  return event.message_id !== undefined ? [event.message_id] : [];
}

/**
 * Fold a `delete_message` event into the unread set: a deleted message
 * can no longer be unread. Returns a new set; the input is never
 * mutated. Unknown ids are tolerated.
 */
export function applyDeleteMessageEventToUnread(
  unread: UnreadSet,
  event: DeleteMessageEvent,
): UnreadSet {
  let changed = false;
  const next = { ...unread };
  for (const id of deletedIds(event)) {
    if (id in next) {
      delete next[id];
      changed = true;
    }
  }
  return changed ? next : unread;
}

/** The number of unread messages currently tracked. */
export function unreadCount(unread: UnreadSet): number {
  return Object.keys(unread).length;
}

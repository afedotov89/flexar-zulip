// Pure reducers for the messages store (Phase 1.3).
//
// The messages store is the app's message cache, keyed by `id`. It has
// two keyed collections:
//   - `messages` — the `Message` objects themselves.
//   - `flags`    — the current user's per-message flags (`read`,
//                  `starred`, `mentioned`, …), kept separate because
//                  the domain `Message` type has no `flags` field:
//                  flags are per-viewer and arrive on `message` events
//                  (`event.flags`) and `update_message_flags` events,
//                  not on the `Message` itself.
//
// The register snapshot carries no message bodies (only the deprecated
// `max_message_id`), so there is no hydration from initial state — the
// store starts empty and is populated two ways:
//   - `ingestMessages` — bulk-insert fetched history. Phase 1.6 owns
//     the `getMessages` fetch + feed; this is the seam it writes
//     through.
//   - the event reducers below — the live `message` / `update_message`
//     / `delete_message` / `reaction` / `update_message_flags` stream.
//
// All reducers are pure: they return new records and never mutate the
// inputs.

import type {
  DeleteMessageEvent,
  Message,
  MessageEvent,
  MessageFlag,
  MessageId,
  ReactionEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
} from "../domain";

/** The message cache, keyed by `id`. */
export type MessageMap = Record<MessageId, Message>;
/** The current user's per-message flags, keyed by message `id`. */
export type FlagMap = Record<MessageId, MessageFlag[]>;

/** The messages store's full keyed state. */
export interface MessagesSnapshot {
  messages: MessageMap;
  flags: FlagMap;
}

/** The empty starting state — the store hydrates nothing from `register`. */
export function emptyMessagesSnapshot(): MessagesSnapshot {
  return { messages: {}, flags: {} };
}

/**
 * Bulk-insert fetched messages into the cache. Phase 1.6's history
 * fetch writes through here. Each message's optional per-viewer flags
 * are merged into the `flags` map; omit `flagsById` for sources (like
 * `getMessages`) that do not carry flags. Returns a new snapshot;
 * inputs are never mutated.
 */
export function ingestMessages(
  snapshot: MessagesSnapshot,
  incoming: readonly Message[],
  flagsById?: Readonly<Record<MessageId, MessageFlag[]>>,
): MessagesSnapshot {
  if (incoming.length === 0) {
    return snapshot;
  }
  const messages = { ...snapshot.messages };
  const flags = { ...snapshot.flags };
  for (const message of incoming) {
    messages[message.id] = message;
    const incomingFlags = flagsById?.[message.id];
    if (incomingFlags !== undefined) {
      flags[message.id] = incomingFlags;
    }
  }
  return { messages, flags };
}

/**
 * Fold a `message` event (a newly received message) into the cache.
 * The event carries both the `Message` and the viewer's `flags` for
 * it. Returns a new snapshot; inputs are never mutated.
 */
export function applyMessageEvent(
  snapshot: MessagesSnapshot,
  event: MessageEvent,
): MessagesSnapshot {
  return {
    messages: { ...snapshot.messages, [event.message.id]: event.message },
    flags: { ...snapshot.flags, [event.message.id]: event.flags },
  };
}

/**
 * Fold an `update_message` event (edit, move, or pure re-render) into
 * the cache. Returns a new snapshot; inputs are never mutated.
 *
 * Content changes apply to `message_id` only; topic/channel moves
 * apply to every id in `message_ids`. Only fields the event actually
 * carries are touched — a topic move does not clobber content, a
 * content edit does not clobber the topic. Messages not in the cache
 * are skipped (the edit raced ahead of a fetch that has not happened).
 */
export function applyUpdateMessageEvent(
  snapshot: MessagesSnapshot,
  event: UpdateMessageEvent,
): MessagesSnapshot {
  // The content patch — applied to the single edited message only.
  const contentPatch: Partial<Message> = {};
  if (event.rendered_content !== undefined) {
    contentPatch.content = event.rendered_content;
  }
  if (event.is_me_message !== undefined) {
    contentPatch.is_me_message = event.is_me_message;
  }
  if (!event.rendering_only) {
    contentPatch.last_edit_timestamp = event.edit_timestamp;
  }

  // The move patch — topic and/or channel — applied to every id in
  // `message_ids`.
  const movePatch: Partial<Message> = {};
  if (event.subject !== undefined) {
    movePatch.subject = event.subject;
  }
  if (event.topic_links !== undefined) {
    movePatch.topic_links = event.topic_links;
  }
  if (event.new_stream_id !== undefined) {
    movePatch.stream_id = event.new_stream_id;
  }
  const isMove =
    event.subject !== undefined || event.new_stream_id !== undefined;

  const ids = new Set<MessageId>(event.message_ids);
  ids.add(event.message_id);

  let changed = false;
  const messages = { ...snapshot.messages };
  for (const id of ids) {
    const existing = messages[id];
    if (existing === undefined) {
      continue;
    }
    // The content patch is for the edited message; the move patch is
    // for every message the move propagated to.
    const patch: Partial<Message> = {
      ...(id === event.message_id ? contentPatch : {}),
      ...movePatch,
    };
    if (isMove) {
      patch.last_moved_timestamp = event.edit_timestamp;
    }
    if (Object.keys(patch).length === 0) {
      continue;
    }
    messages[id] = { ...existing, ...patch };
    changed = true;
  }
  return changed ? { ...snapshot, messages } : snapshot;
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
 * Fold a `delete_message` event into the cache: drop the deleted
 * messages and their flags. Returns a new snapshot; inputs are never
 * mutated. Unknown ids are tolerated.
 */
export function applyDeleteMessageEvent(
  snapshot: MessagesSnapshot,
  event: DeleteMessageEvent,
): MessagesSnapshot {
  let changed = false;
  const messages = { ...snapshot.messages };
  const flags = { ...snapshot.flags };
  for (const id of deletedIds(event)) {
    if (id in messages) {
      delete messages[id];
      changed = true;
    }
    if (id in flags) {
      delete flags[id];
      changed = true;
    }
  }
  return changed ? { messages, flags } : snapshot;
}

/**
 * Fold a `reaction` event into the cache by adding or removing the
 * reaction on the target message's `reactions` array. Returns a new
 * snapshot; inputs are never mutated.
 *
 *   - `add`    — append the reaction, unless an identical
 *                (user + emoji) one is already present (idempotent).
 *   - `remove` — drop the matching (user + emoji) reaction.
 *
 * A reaction for a message not in the cache is a no-op.
 */
export function applyReactionEvent(
  snapshot: MessagesSnapshot,
  event: ReactionEvent,
): MessagesSnapshot {
  const message = snapshot.messages[event.message_id];
  if (message === undefined) {
    return snapshot;
  }
  // A reaction is identified by who reacted with which emoji.
  const isSame = (r: Message["reactions"][number]): boolean =>
    r.user_id === event.user_id &&
    r.emoji_code === event.emoji_code &&
    r.reaction_type === event.reaction_type;

  let reactions: Message["reactions"];
  if (event.op === "add") {
    if (message.reactions.some(isSame)) {
      return snapshot;
    }
    reactions = [
      ...message.reactions,
      {
        user_id: event.user_id,
        emoji_name: event.emoji_name,
        emoji_code: event.emoji_code,
        reaction_type: event.reaction_type,
      },
    ];
  } else {
    const filtered = message.reactions.filter((r) => !isSame(r));
    if (filtered.length === message.reactions.length) {
      return snapshot;
    }
    reactions = filtered;
  }

  return {
    ...snapshot,
    messages: {
      ...snapshot.messages,
      [event.message_id]: { ...message, reactions },
    },
  };
}

/**
 * Fold an `update_message_flags` event into the `flags` map. Returns a
 * new snapshot; inputs are never mutated.
 *
 *   - `op: "add"` with `all: true` — the flag was applied to *every*
 *     message (only meaningful for `read`); `messages` is empty. We
 *     add the flag to every message currently in the cache.
 *   - `op: "add"`  — add the flag to each listed message.
 *   - `op: "remove"` — remove the flag from each listed message.
 *
 * Flags for messages not in the cache are still tracked: a message may
 * be flagged before its body is fetched, and the flag must survive
 * until the body lands.
 */
export function applyUpdateMessageFlagsEvent(
  snapshot: MessagesSnapshot,
  event: UpdateMessageFlagsEvent,
): MessagesSnapshot {
  const targetIds: MessageId[] =
    event.op === "add" && event.all
      ? Object.keys(snapshot.messages).map(Number)
      : event.messages;
  if (targetIds.length === 0) {
    return snapshot;
  }

  let changed = false;
  const flags = { ...snapshot.flags };
  for (const id of targetIds) {
    const current = flags[id] ?? [];
    if (event.op === "add") {
      if (!current.includes(event.flag)) {
        flags[id] = [...current, event.flag];
        changed = true;
      }
    } else {
      if (current.includes(event.flag)) {
        flags[id] = current.filter((f) => f !== event.flag);
        changed = true;
      }
    }
  }
  return changed ? { ...snapshot, flags } : snapshot;
}

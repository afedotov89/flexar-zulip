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
  EmojiIdentity,
  Message,
  MessageEvent,
  MessageFlag,
  MessageId,
  ReactionEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
  UserId,
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
 * Insert one optimistic-echo message into the cache (Phase 2.2). Phase
 * 2.2's compose-send writes through here so the user's freshly sent
 * message appears in the feed immediately, before the REST response or
 * the live `message` event lands.
 *
 * The id must be a *local* id distinguishable from real ids (Zulip ids
 * are positive integers — the compose layer uses negatives). Inserting
 * is otherwise the same as a normal ingest: the message goes into the
 * `messages` map; if `flags` is supplied, those are written into the
 * `flags` map under the same id. Returns a new snapshot.
 */
export function insertOptimisticMessage(
  snapshot: MessagesSnapshot,
  message: Message,
  flags?: readonly MessageFlag[],
): MessagesSnapshot {
  const messages = { ...snapshot.messages, [message.id]: message };
  if (flags === undefined) {
    return { ...snapshot, messages };
  }
  return {
    messages,
    flags: { ...snapshot.flags, [message.id]: [...flags] },
  };
}

/**
 * Reconcile an optimistic-echo entry with the real message the server
 * assigned an id to (Phase 2.2). Removes the optimistic entry under
 * `localId` and — if the real message is not already in the cache (the
 * `message` event may have raced ahead) — inserts it under its real id.
 * Either ordering yields the same final cache. Returns a new snapshot.
 *
 * The optimistic and real entries are never both retained: the real id
 * is the canonical one once the server has assigned it; the local id is
 * never seen again.
 */
export function reconcileOptimisticMessage(
  snapshot: MessagesSnapshot,
  localId: MessageId,
  realMessage: Message,
): MessagesSnapshot {
  let messages = snapshot.messages;
  let flags = snapshot.flags;

  // Drop the optimistic entry, if present.
  if (localId in messages || localId in flags) {
    messages = { ...messages };
    flags = { ...flags };
    delete messages[localId];
    delete flags[localId];
  }

  // Insert the real message only if it is not already there: a `message`
  // event for our own send may have arrived before the REST response,
  // in which case the cache already holds the canonical entry (with
  // the viewer's flags) and we must not clobber it.
  if (!(realMessage.id in messages)) {
    messages = { ...messages, [realMessage.id]: realMessage };
  }
  return { messages, flags };
}

/**
 * Drop an optimistic-echo entry from the cache (Phase 2.2). Used on
 * send failure to remove the message that never made it. A no-op if
 * the id is unknown.
 */
export function removeOptimisticMessage(
  snapshot: MessagesSnapshot,
  localId: MessageId,
): MessagesSnapshot {
  if (!(localId in snapshot.messages) && !(localId in snapshot.flags)) {
    return snapshot;
  }
  const messages = { ...snapshot.messages };
  const flags = { ...snapshot.flags };
  delete messages[localId];
  delete flags[localId];
  return { messages, flags };
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

/** A pending optimistic reaction the UI wants to apply (Phase 3.2). */
export interface OptimisticReaction {
  message_id: MessageId;
  op: "add" | "remove";
  user_id: UserId;
  emoji: EmojiIdentity;
}

/**
 * Optimistically add or remove a reaction in the cache (Phase 3.2). The
 * UI calls this immediately on click — before the REST request — so the
 * chip updates without a round-trip; the realtime `reaction` event
 * arrives shortly after and `applyReactionEvent` is idempotent on the
 * same `(user, type, code)` triple, so the optimistic state harmonizes
 * with the event-delivered state without a flicker. On REST failure the
 * caller flips `op` and runs the same reducer to revert.
 *
 * The behaviour mirrors `applyReactionEvent` exactly — same identity,
 * same idempotency, same no-op-for-uncached-message handling — so the
 * two paths cannot diverge.
 */
export function applyOptimisticReaction(
  snapshot: MessagesSnapshot,
  pending: OptimisticReaction,
): MessagesSnapshot {
  const message = snapshot.messages[pending.message_id];
  if (message === undefined) {
    return snapshot;
  }
  const isSame = (r: Message["reactions"][number]): boolean =>
    r.user_id === pending.user_id &&
    r.emoji_code === pending.emoji.emoji_code &&
    r.reaction_type === pending.emoji.reaction_type;

  let reactions: Message["reactions"];
  if (pending.op === "add") {
    if (message.reactions.some(isSame)) {
      return snapshot;
    }
    reactions = [
      ...message.reactions,
      {
        user_id: pending.user_id,
        emoji_name: pending.emoji.emoji_name,
        emoji_code: pending.emoji.emoji_code,
        reaction_type: pending.emoji.reaction_type,
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
      [pending.message_id]: { ...message, reactions },
    },
  };
}

/** A pending optimistic content edit the UI wants to apply (Phase 3.3). */
export interface OptimisticEdit {
  message_id: MessageId;
  /**
   * The new content to swap in. The cache stores rendered HTML; on an
   * optimistic edit we have only the user-typed Markdown, so we drop it
   * in directly. Whichever form the cache held becomes Markdown until
   * the realtime `update_message` event lands with the server-rendered
   * HTML and reconciles. Visually the row continues to render through
   * `MessageContent`, which sanitises whatever it is given.
   */
  content: string;
}

/** A pending optimistic delete the UI wants to apply (Phase 3.3). */
export interface OptimisticDelete {
  message_id: MessageId;
}

/** A pending optimistic flag change the UI wants to apply (Phase 3.3). */
export interface OptimisticFlag {
  message_id: MessageId;
  op: "add" | "remove";
  flag: MessageFlag;
}

/**
 * Optimistically edit a cached message's content (Phase 3.3). The UI
 * calls this immediately on Save — before the REST request — so the
 * row updates without a round-trip; the realtime `update_message` event
 * arrives shortly after with the server-rendered HTML and reconciles.
 *
 * Mirrors `applyUpdateMessageEvent`'s content-edit branch: writes
 * `content` and stamps `last_edit_timestamp` (seconds since epoch). On
 * REST failure the caller restores the prior `Message` directly — there
 * is no inverse op for an edit, so the caller passes the snapshot back
 * through `restoreMessage` to roll back. A no-op on uncached ids.
 */
export function applyOptimisticEdit(
  snapshot: MessagesSnapshot,
  pending: OptimisticEdit,
): MessagesSnapshot {
  const message = snapshot.messages[pending.message_id];
  if (message === undefined) {
    return snapshot;
  }
  if (message.content === pending.content) {
    return snapshot;
  }
  return {
    ...snapshot,
    messages: {
      ...snapshot.messages,
      [pending.message_id]: {
        ...message,
        content: pending.content,
        last_edit_timestamp: Math.floor(Date.now() / 1000),
      },
    },
  };
}

/**
 * Restore a previously-cached `Message` by id (Phase 3.3). Used to
 * revert a failed optimistic edit: the caller snapshotted the original
 * `Message` before the edit and passes it back here on REST failure.
 * Inserts it under its id verbatim. Pure; never mutates the input.
 */
export function restoreMessage(
  snapshot: MessagesSnapshot,
  message: Message,
): MessagesSnapshot {
  return {
    ...snapshot,
    messages: { ...snapshot.messages, [message.id]: message },
  };
}

/**
 * Optimistically drop a cached message and its flags (Phase 3.3). The
 * UI calls this immediately on confirm — the realtime `delete_message`
 * event arrives shortly after and `applyDeleteMessageEvent` is
 * idempotent on an already-deleted id, so the two paths converge.
 *
 * On REST failure the caller has snapshotted the original `Message` /
 * flags and re-inserts them (`restoreMessage` for the body,
 * `restoreFlags` for the flag set). A no-op on uncached ids.
 */
export function applyOptimisticDelete(
  snapshot: MessagesSnapshot,
  pending: OptimisticDelete,
): MessagesSnapshot {
  const inMessages = pending.message_id in snapshot.messages;
  const inFlags = pending.message_id in snapshot.flags;
  if (!inMessages && !inFlags) {
    return snapshot;
  }
  const messages = { ...snapshot.messages };
  const flags = { ...snapshot.flags };
  delete messages[pending.message_id];
  delete flags[pending.message_id];
  return { messages, flags };
}

/**
 * Re-attach previously-cached `flags` for a message id (Phase 3.3).
 * Used together with `restoreMessage` to revert a failed optimistic
 * delete. Pure; never mutates the input.
 */
export function restoreFlags(
  snapshot: MessagesSnapshot,
  messageId: MessageId,
  flags: readonly MessageFlag[],
): MessagesSnapshot {
  return {
    ...snapshot,
    flags: { ...snapshot.flags, [messageId]: [...flags] },
  };
}

/**
 * Optimistically add or remove a per-viewer flag on one cached message
 * (Phase 3.3). Mirrors `applyUpdateMessageFlagsEvent` for a single id
 * with the same idempotency: adding a flag already present, or removing
 * one that is absent, is a no-op (returns the same snapshot reference).
 *
 * The realtime `update_message_flags` event lands shortly after; the
 * event reducer is idempotent on the same `(id, flag, op)` triple, so
 * it harmonises with the optimistic state without a flicker. On REST
 * failure the caller flips `op` and runs this same reducer to revert.
 */
export function applyOptimisticFlag(
  snapshot: MessagesSnapshot,
  pending: OptimisticFlag,
): MessagesSnapshot {
  const current = snapshot.flags[pending.message_id] ?? [];
  if (pending.op === "add") {
    if (current.includes(pending.flag)) {
      return snapshot;
    }
    return {
      ...snapshot,
      flags: {
        ...snapshot.flags,
        [pending.message_id]: [...current, pending.flag],
      },
    };
  }
  if (!current.includes(pending.flag)) {
    return snapshot;
  }
  return {
    ...snapshot,
    flags: {
      ...snapshot.flags,
      [pending.message_id]: current.filter((f) => f !== pending.flag),
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

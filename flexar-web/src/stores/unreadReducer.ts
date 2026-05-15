// Pure reducers for the unread store (Phase 1.3, restructured in 1.5).
//
// The unread store tracks which messages the current user has not read.
// Phase 1.3 kept this as a single flat id set, which only answered "how
// many unread in total". The left sidebar (Phase 1.5) needs unread
// counts *per conversation* — per channel, per channel-topic, and per
// DM conversation — so the store now keeps the unread state in the same
// bucketed shape the register snapshot's `unread_msgs` key already uses.
//
// ── Bucket model ────────────────────────────────────────────────────
//
// `UnreadBuckets` holds four things:
//   - `channels`  — streamId → topic → set of unread message ids.
//   - `dms`       — DM conversation key → set of unread message ids.
//   - `mentions`  — set of unread message ids the viewer is mentioned
//                   in. This is an *overlay*, not a fourth disjoint
//                   bucket: a mentioned message is also filed into its
//                   channel-topic or DM bucket. The set is kept in step
//                   with the same `read`/`delete` events that empty the
//                   conversation buckets, and a `message` event whose
//                   `mentioned` flag is set adds the id here too.
//   - `location`  — messageId → which bucket it lives in. This reverse
//                   index is what lets flag/delete/move events, which
//                   only carry message ids, find and update the right
//                   bucket without scanning.
//
// A *DM conversation key* is the sorted list of all participant user
// ids (including the viewer), joined with `,` — the same encoding the
// narrow codec uses for `dm` operands. The register snapshot's `pms`
// buckets carry only the *other* user id, so the viewer's id is mixed
// in at hydration time; `huddles` already carry the full id string.
//
// `unread_msgs` is an API-envelope shape, not a domain entity, and is
// not modelled in `src/domain` (the domain `events.ts` deliberately
// stops at the core chat events). It is described locally here,
// mirroring the `register` response in `zerver/openapi/zulip.yaml`.
//
// ── How events move the buckets ─────────────────────────────────────
//
//   - `message`              — a newly received message is unread,
//                              *unless* the viewer sent it or it
//                              already carries the `read` flag. It is
//                              filed into its channel-topic or DM
//                              bucket (derived from the message body).
//   - `update_message`       — a topic and/or channel move re-files
//                              every moved message id that is currently
//                              unread into the new channel-topic bucket.
//   - `update_message_flags` — `read` flag: `add` marks ids read
//                              (remove from their bucket), `remove`
//                              marks them unread again. `add` with
//                              `all: true` clears everything. Other
//                              flags are ignored. Note `remove` can
//                              only restore ids whose bucket is still
//                              known (`location` still has them).
//   - `delete_message`       — a deleted message can no longer be
//                              unread; drop its id from its bucket.
//
// All reducers are pure: they return new structures and never mutate
// their inputs.

import type {
  DeleteMessageEvent,
  MessageEvent,
  MessageId,
  StreamId,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
  UserId,
} from "../domain";
import type { InitialState } from "../realtime";

/** A set of message ids — membership-tested by the read path. */
export type UnreadIdSet = Record<MessageId, true>;

/** Where an unread message lives, so id-only events can re-bucket it. */
export type UnreadLocation =
  | { kind: "channel"; streamId: StreamId; topic: string }
  | { kind: "dm"; conversationKey: string };

/**
 * The bucketed unread state. `channels` and `dms` carry the id sets the
 * sidebar counts; `mentions` is an overlay set of unread ids the viewer
 * is mentioned in; `location` is the reverse index keyed by message id.
 */
export interface UnreadBuckets {
  /** streamId → topic → set of unread message ids in that topic. */
  channels: Record<StreamId, Record<string, UnreadIdSet>>;
  /** DM conversation key → set of unread message ids. */
  dms: Record<string, UnreadIdSet>;
  /**
   * Unread message ids the viewer is mentioned in. An overlay over the
   * conversation buckets — every id here is also filed in `channels` or
   * `dms` (or was, before a `read`/`delete` removed it everywhere).
   */
  mentions: UnreadIdSet;
  /** messageId → its bucket, for flag/delete/move re-bucketing. */
  location: Record<MessageId, UnreadLocation>;
}

/** An empty bucket state — the store's value before the first hydrate. */
export function emptyUnreadBuckets(): UnreadBuckets {
  return { channels: {}, dms: {}, mentions: {}, location: {} };
}

/**
 * The `unread_msgs` envelope from the register response. Only the
 * fields needed to bucket every unread message id are modelled.
 */
interface UnreadMsgsEnvelope {
  pms?: Array<{ other_user_id: UserId; unread_message_ids: MessageId[] }>;
  streams?: Array<{
    stream_id: StreamId;
    topic: string;
    unread_message_ids: MessageId[];
  }>;
  huddles?: Array<{
    user_ids_string: string;
    unread_message_ids: MessageId[];
  }>;
  mentions?: MessageId[];
}

/**
 * Build a DM conversation key from a set of participant user ids: the
 * sorted, de-duplicated ids joined with `,`. The viewer's own id is
 * part of the key, so a 1:1 DM and a group DM are encoded uniformly,
 * matching the narrow codec's `dm` operand.
 */
export function dmConversationKey(participantIds: readonly UserId[]): string {
  const unique = Array.from(new Set(participantIds));
  unique.sort((a, b) => a - b);
  return unique.join(",");
}

// ── Internal bucket helpers (all pure, all copy-on-write) ────────────

// Add an id to a channel-topic bucket, returning a new `channels` map.
function addToChannel(
  channels: UnreadBuckets["channels"],
  streamId: StreamId,
  topic: string,
  id: MessageId,
): UnreadBuckets["channels"] {
  const topics = channels[streamId] ?? {};
  const ids = topics[topic] ?? {};
  return {
    ...channels,
    [streamId]: { ...topics, [topic]: { ...ids, [id]: true } },
  };
}

// Remove an id from a channel-topic bucket, pruning now-empty topics
// and channels so empty buckets never linger. Returns a new map.
function removeFromChannel(
  channels: UnreadBuckets["channels"],
  streamId: StreamId,
  topic: string,
  id: MessageId,
): UnreadBuckets["channels"] {
  const topics = channels[streamId];
  if (topics === undefined) {
    return channels;
  }
  const ids = topics[topic];
  if (ids === undefined || ids[id] !== true) {
    return channels;
  }
  const nextIds = { ...ids };
  delete nextIds[id];
  const nextTopics = { ...topics };
  if (Object.keys(nextIds).length === 0) {
    delete nextTopics[topic];
  } else {
    nextTopics[topic] = nextIds;
  }
  const nextChannels = { ...channels };
  if (Object.keys(nextTopics).length === 0) {
    delete nextChannels[streamId];
  } else {
    nextChannels[streamId] = nextTopics;
  }
  return nextChannels;
}

// Add an id to a DM bucket, returning a new `dms` map.
function addToDm(
  dms: UnreadBuckets["dms"],
  conversationKey: string,
  id: MessageId,
): UnreadBuckets["dms"] {
  const ids = dms[conversationKey] ?? {};
  return { ...dms, [conversationKey]: { ...ids, [id]: true } };
}

// Remove an id from a DM bucket, pruning the bucket when it empties.
function removeFromDm(
  dms: UnreadBuckets["dms"],
  conversationKey: string,
  id: MessageId,
): UnreadBuckets["dms"] {
  const ids = dms[conversationKey];
  if (ids === undefined || ids[id] !== true) {
    return dms;
  }
  const nextIds = { ...ids };
  delete nextIds[id];
  const nextDms = { ...dms };
  if (Object.keys(nextIds).length === 0) {
    delete nextDms[conversationKey];
  } else {
    nextDms[conversationKey] = nextIds;
  }
  return nextDms;
}

// Add an id to the mentions overlay, returning a new set. A no-op (same
// reference) when the id is already present.
function addToMentions(
  mentions: UnreadIdSet,
  id: MessageId,
): UnreadIdSet {
  if (mentions[id] === true) {
    return mentions;
  }
  return { ...mentions, [id]: true };
}

// Remove an id from the mentions overlay, returning a new set. A no-op
// (same reference) when the id is not present.
function removeFromMentions(
  mentions: UnreadIdSet,
  id: MessageId,
): UnreadIdSet {
  if (mentions[id] !== true) {
    return mentions;
  }
  const next = { ...mentions };
  delete next[id];
  return next;
}

// File one id into the bucket named by `location`, returning new
// buckets. The reverse `location` index is updated too; the `mentions`
// overlay is carried through untouched.
function fileId(
  buckets: UnreadBuckets,
  id: MessageId,
  location: UnreadLocation,
): UnreadBuckets {
  if (location.kind === "channel") {
    return {
      channels: addToChannel(
        buckets.channels,
        location.streamId,
        location.topic,
        id,
      ),
      dms: buckets.dms,
      mentions: buckets.mentions,
      location: { ...buckets.location, [id]: location },
    };
  }
  return {
    channels: buckets.channels,
    dms: addToDm(buckets.dms, location.conversationKey, id),
    mentions: buckets.mentions,
    location: { ...buckets.location, [id]: location },
  };
}

// Drop one id from whatever bucket it currently lives in *and* from the
// mentions overlay, returning new buckets. A no-op (same reference)
// when the id is neither tracked in a conversation bucket nor mentioned.
function unfileId(buckets: UnreadBuckets, id: MessageId): UnreadBuckets {
  const location = buckets.location[id];
  const nextMentions = removeFromMentions(buckets.mentions, id);
  if (location === undefined) {
    // Not in a conversation bucket; only the mentions overlay can change.
    return nextMentions === buckets.mentions
      ? buckets
      : { ...buckets, mentions: nextMentions };
  }
  const nextLocation = { ...buckets.location };
  delete nextLocation[id];
  if (location.kind === "channel") {
    return {
      channels: removeFromChannel(
        buckets.channels,
        location.streamId,
        location.topic,
        id,
      ),
      dms: buckets.dms,
      mentions: nextMentions,
      location: nextLocation,
    };
  }
  return {
    channels: buckets.channels,
    dms: removeFromDm(buckets.dms, location.conversationKey, id),
    mentions: nextMentions,
    location: nextLocation,
  };
}

/**
 * Bucket a register snapshot's `unread_msgs` into `UnreadBuckets`.
 * Returns an empty bucket state when the snapshot has no `unread_msgs`
 * key (its `event_types` did not include both `message` and
 * `update_message_flags`).
 *
 * `ownUserId` is mixed into every `pms` conversation key, since those
 * buckets carry only the *other* participant. Pass `null` when the
 * viewer id is not yet known — the next re-register re-hydrates with it.
 *
 * The `mentions` array is projected into the `mentions` overlay set.
 * Its ids are also a subset of the per-conversation buckets, so they
 * are filed there as well.
 */
export function unreadFromInitialState(
  state: InitialState,
  ownUserId: UserId | null,
): UnreadBuckets {
  const raw = state.unread_msgs;
  if (raw == null || typeof raw !== "object") {
    return emptyUnreadBuckets();
  }
  const envelope = raw as UnreadMsgsEnvelope;
  let buckets = emptyUnreadBuckets();

  if (Array.isArray(envelope.streams)) {
    for (const conversation of envelope.streams) {
      for (const id of conversation.unread_message_ids) {
        buckets = fileId(buckets, id, {
          kind: "channel",
          streamId: conversation.stream_id,
          topic: conversation.topic,
        });
      }
    }
  }

  if (Array.isArray(envelope.pms)) {
    for (const conversation of envelope.pms) {
      const participants =
        ownUserId === null
          ? [conversation.other_user_id]
          : [ownUserId, conversation.other_user_id];
      const conversationKey = dmConversationKey(participants);
      for (const id of conversation.unread_message_ids) {
        buckets = fileId(buckets, id, { kind: "dm", conversationKey });
      }
    }
  }

  if (Array.isArray(envelope.huddles)) {
    for (const conversation of envelope.huddles) {
      const ids = conversation.user_ids_string
        .split(",")
        .map((part) => Number(part))
        .filter((n) => Number.isInteger(n));
      const conversationKey = dmConversationKey(ids);
      for (const id of conversation.unread_message_ids) {
        buckets = fileId(buckets, id, { kind: "dm", conversationKey });
      }
    }
  }

  if (Array.isArray(envelope.mentions)) {
    let mentions = buckets.mentions;
    for (const id of envelope.mentions) {
      mentions = addToMentions(mentions, id);
    }
    if (mentions !== buckets.mentions) {
      buckets = { ...buckets, mentions };
    }
  }

  return buckets;
}

// Derive the bucket a `message` event's message belongs in. Channel
// messages go to their stream + topic (`subject`); direct messages go
// to the DM conversation built from the participant ids.
function locationForMessage(
  event: MessageEvent,
): UnreadLocation | undefined {
  const { message } = event;
  if (message.type === "stream") {
    if (message.stream_id === undefined) {
      return undefined;
    }
    return {
      kind: "channel",
      streamId: message.stream_id,
      topic: message.subject,
    };
  }
  // Direct message: `display_recipient` lists every participant.
  if (!Array.isArray(message.display_recipient)) {
    return undefined;
  }
  const participantIds = message.display_recipient.map(
    (recipient) => recipient.id,
  );
  return { kind: "dm", conversationKey: dmConversationKey(participantIds) };
}

/**
 * Fold a `message` event into the buckets. A freshly received message
 * is unread unless the viewer sent it (senders have implicitly read
 * their own messages) or the server already attached the `read` flag.
 * When the event carries the `mentioned` flag, the message id is added
 * to the `mentions` overlay as well. Returns new buckets; the input is
 * never mutated.
 *
 * `ownUserId` is the viewer's user id; pass `null` when it is not yet
 * known (the message is then treated as unread, which the next
 * `update_message_flags`/snapshot corrects).
 */
export function applyMessageEventToUnread(
  buckets: UnreadBuckets,
  event: MessageEvent,
  ownUserId: UserId | null,
): UnreadBuckets {
  const { message } = event;
  if (message.sender_id === ownUserId || event.flags.includes("read")) {
    return buckets;
  }
  // An already-tracked id is left in place, but the mentions overlay is
  // still reconciled — a later event could carry the `mentioned` flag.
  const mentioned = event.flags.includes("mentioned");
  if (buckets.location[message.id] !== undefined) {
    if (!mentioned) {
      return buckets;
    }
    const mentions = addToMentions(buckets.mentions, message.id);
    return mentions === buckets.mentions
      ? buckets
      : { ...buckets, mentions };
  }
  const location = locationForMessage(event);
  if (location === undefined) {
    return buckets;
  }
  const filed = fileId(buckets, message.id, location);
  if (!mentioned) {
    return filed;
  }
  return {
    ...filed,
    mentions: addToMentions(filed.mentions, message.id),
  };
}

/**
 * Fold an `update_message` event into the buckets. Only topic/channel
 * *moves* matter here: a move re-files every moved message id that is
 * currently unread into its new channel-topic bucket. Pure content
 * edits and rendering-only updates leave the buckets untouched.
 * Returns new buckets; the input is never mutated.
 */
export function applyUpdateMessageEventToUnread(
  buckets: UnreadBuckets,
  event: UpdateMessageEvent,
): UnreadBuckets {
  // A move is signalled by a new channel id and/or a new topic. With
  // neither, nothing was re-bucketed.
  const movedChannel = event.new_stream_id !== undefined;
  const movedTopic = event.subject !== undefined;
  if (!movedChannel && !movedTopic) {
    return buckets;
  }

  let next = buckets;
  for (const id of event.message_ids) {
    const location = next.location[id];
    // Only channel messages are re-bucketed by a move, and only ids
    // that are still unread (still tracked) need re-filing.
    if (location === undefined || location.kind !== "channel") {
      continue;
    }
    const streamId = event.new_stream_id ?? location.streamId;
    const topic = event.subject ?? location.topic;
    if (streamId === location.streamId && topic === location.topic) {
      continue;
    }
    next = unfileId(next, id);
    next = fileId(next, id, { kind: "channel", streamId, topic });
  }
  return next;
}

/**
 * Fold an `update_message_flags` event into the buckets. Only the
 * `read` flag is relevant: marking messages read removes them from
 * their buckets, un-marking restores ids whose bucket is still known.
 * `op: "add"` with `all: true` clears everything. Returns new buckets;
 * the input is never mutated.
 *
 * Caveat: `op: "remove"` (mark unread again) can only restore an id
 * whose `location` is still tracked. An id whose bucket was already
 * forgotten cannot be re-filed from the flag event alone — the event
 * carries no channel/topic/recipient. In practice the server resends a
 * fresh snapshot on reconnect, which re-establishes the buckets.
 */
export function applyUpdateMessageFlagsEventToUnread(
  buckets: UnreadBuckets,
  event: UpdateMessageFlagsEvent,
): UnreadBuckets {
  if (event.flag !== "read") {
    return buckets;
  }
  if (event.op === "add") {
    if (event.all) {
      return emptyUnreadBuckets();
    }
    let next = buckets;
    for (const id of event.messages) {
      next = unfileId(next, id);
    }
    return next;
  }
  // `op: "remove"` — messages were marked unread again. Only ids whose
  // bucket is still known can be restored.
  let next = buckets;
  for (const id of event.messages) {
    const location = next.location[id];
    if (location !== undefined) {
      next = fileId(next, id, location);
    }
  }
  return next;
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
 * Drop the listed ids from whatever bucket they currently live in
 * (Phase 3.4). This is the optimistic counterpart to the realtime
 * `update_message_flags(op:add, flag:read, messages:[…])` event the
 * mark-as-read paths trigger — applying the same removal locally
 * before the round-trip lets the sidebar counters update without
 * waiting. The corresponding realtime event reducer is idempotent on
 * the same ids, so the two harmonise without a flicker. A no-op
 * (returns the same reference) when no listed id is currently tracked.
 */
export function markIdsRead(
  buckets: UnreadBuckets,
  messageIds: readonly MessageId[],
): UnreadBuckets {
  let next = buckets;
  for (const id of messageIds) {
    next = unfileId(next, id);
  }
  return next;
}

/**
 * Fold a `delete_message` event into the buckets: a deleted message can
 * no longer be unread, so its id is dropped from whatever bucket holds
 * it. Returns new buckets; the input is never mutated. Unknown ids are
 * tolerated.
 */
export function applyDeleteMessageEventToUnread(
  buckets: UnreadBuckets,
  event: DeleteMessageEvent,
): UnreadBuckets {
  let next = buckets;
  for (const id of deletedIds(event)) {
    next = unfileId(next, id);
  }
  return next;
}

// ── Selectors over the bucket state ─────────────────────────────────

/** The total number of unread messages tracked, across all buckets. */
export function unreadCount(buckets: UnreadBuckets): number {
  return Object.keys(buckets.location).length;
}

/** The number of unread messages in a single channel (all its topics). */
export function channelUnreadCount(
  buckets: UnreadBuckets,
  streamId: StreamId,
): number {
  const topics = buckets.channels[streamId];
  if (topics === undefined) {
    return 0;
  }
  let total = 0;
  for (const ids of Object.values(topics)) {
    total += Object.keys(ids).length;
  }
  return total;
}

/** The number of unread messages in a single channel-topic. */
export function topicUnreadCount(
  buckets: UnreadBuckets,
  streamId: StreamId,
  topic: string,
): number {
  const ids = buckets.channels[streamId]?.[topic];
  return ids === undefined ? 0 : Object.keys(ids).length;
}

/** The number of unread messages in a single DM conversation. */
export function dmUnreadCount(
  buckets: UnreadBuckets,
  conversationKey: string,
): number {
  const ids = buckets.dms[conversationKey];
  return ids === undefined ? 0 : Object.keys(ids).length;
}

/** The conversation keys of every DM that currently has unread messages. */
export function dmConversationKeysWithUnread(
  buckets: UnreadBuckets,
): string[] {
  return Object.keys(buckets.dms);
}

/** The number of unread messages the viewer is mentioned in. */
export function mentionsCount(buckets: UnreadBuckets): number {
  return Object.keys(buckets.mentions).length;
}

/** Whether a given message is currently tracked as unread. */
export function isUnread(
  buckets: UnreadBuckets,
  messageId: MessageId,
): boolean {
  return buckets.location[messageId] !== undefined;
}

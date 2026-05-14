// Pure reducers for the DM conversations store (Phase 1.5a).
//
// Phase 1.5's left sidebar could only list DM conversations that had
// *unread* messages, derived from `unreadStore`'s DM buckets. This
// reducer set backs a proper store of *all* the viewer's DM
// conversations — read ones included — in recency order.
//
// ── Conversation model ──────────────────────────────────────────────
//
// A `DmConversation` is identified by its `conversationKey`: the
// sorted, comma-joined participant user ids *including the viewer* —
// the exact encoding `unreadStore` and the narrow codec's `dm` operand
// use, so a key from this store can be handed straight to either. It
// also carries `maxMessageId`, the id of the most recent message in
// the conversation, which is what the list is ordered by (descending —
// most recent first).
//
// ── Hydration source ────────────────────────────────────────────────
//
// The register snapshot's `recent_private_conversations` key: an array
// of `{ max_message_id, user_ids }`, where `user_ids` lists the *other*
// participants (empty for a self-DM). The viewer's own id is mixed in
// at hydration time to form the full `conversationKey`.
//
// `recent_private_conversations` is an API-envelope shape, not a domain
// entity, so it is described locally here, mirroring the `register`
// response in `zerver/openapi/zulip.yaml`.
//
// ── Live updates ────────────────────────────────────────────────────
//
// A `message` event of DM type bumps the matching conversation's
// `maxMessageId` (and re-sorts it toward the front) or, for a brand new
// conversation, inserts it.
//
// All reducers are pure: they return new structures and never mutate
// their inputs.

import type { MessageEvent, UserId } from "../domain";
import type { InitialState } from "../realtime";
import { dmConversationKey } from "./unreadReducer";

/** One DM (or group-DM) conversation in the viewer's history. */
export interface DmConversation {
  /**
   * Sorted, comma-joined participant user ids *including the viewer* —
   * the same key `unreadStore` and the narrow `dm` operand use.
   */
  conversationKey: string;
  /** Participant user ids including the viewer, sorted ascending. */
  participantIds: UserId[];
  /** Id of the most recent message in the conversation; the sort key. */
  maxMessageId: number;
}

/**
 * The `recent_private_conversations` envelope from the register
 * response: recent DM/group-DM conversations the viewer has
 * participated in. `user_ids` lists the *other* participants and is
 * empty for a self-DM.
 */
interface RecentPrivateConversationsEntry {
  max_message_id: number;
  user_ids: UserId[];
}

/** Order conversations most-recent-first by `maxMessageId`. */
export function conversationsByRecency(
  conversations: readonly DmConversation[],
): DmConversation[] {
  return [...conversations].sort((a, b) => b.maxMessageId - a.maxMessageId);
}

/**
 * Build a `DmConversation` from a participant id set and a most-recent
 * message id. `participantIds` may or may not already include the
 * viewer — `dmConversationKey` de-duplicates — but the viewer's id must
 * be passed in `participantIds` so the key is complete.
 */
function makeConversation(
  participantIds: readonly UserId[],
  maxMessageId: number,
): DmConversation {
  const conversationKey = dmConversationKey(participantIds);
  return {
    conversationKey,
    participantIds: conversationKey
      .split(",")
      .map((part) => Number(part))
      .filter((n) => Number.isInteger(n)),
    maxMessageId,
  };
}

/**
 * Project a register snapshot's `recent_private_conversations` into the
 * recency-ordered conversation list. Returns an empty list when the
 * snapshot has no such key (its `fetch_event_types` did not request
 * it).
 *
 * `ownUserId` is mixed into every conversation's participant set, since
 * the snapshot entries carry only the *other* participants. Pass `null`
 * when the viewer id is not yet known — the next re-register
 * re-hydrates with it.
 */
export function dmConversationsFromInitialState(
  state: InitialState,
  ownUserId: UserId | null,
): DmConversation[] {
  const raw = state.recent_private_conversations;
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries = raw as RecentPrivateConversationsEntry[];
  const conversations = entries.map((entry) => {
    const participants =
      ownUserId === null
        ? entry.user_ids
        : [ownUserId, ...entry.user_ids];
    return makeConversation(participants, entry.max_message_id);
  });
  return conversationsByRecency(conversations);
}

/**
 * Fold a `message` event into the conversation list. A direct message
 * either bumps its conversation's `maxMessageId` (re-sorting it toward
 * the front) or, for a conversation not seen before, inserts it.
 * Channel messages and malformed DM events are ignored. Returns a new
 * list; the input is never mutated. Same reference when nothing
 * changed.
 */
export function applyMessageEventToDmConversations(
  conversations: DmConversation[],
  event: MessageEvent,
): DmConversation[] {
  const { message } = event;
  if (message.type !== "private") {
    return conversations;
  }
  // A direct message's `display_recipient` lists every participant
  // (including the viewer), so no own-id mixing is needed here.
  if (!Array.isArray(message.display_recipient)) {
    return conversations;
  }
  const participantIds = message.display_recipient.map(
    (recipient) => recipient.id,
  );
  const updated = makeConversation(participantIds, message.id);

  const existing = conversations.find(
    (conversation) =>
      conversation.conversationKey === updated.conversationKey,
  );
  // An out-of-order delivery that does not advance the recency id is a
  // no-op for an already-known conversation.
  if (existing !== undefined && existing.maxMessageId >= updated.maxMessageId) {
    return conversations;
  }

  const others = conversations.filter(
    (conversation) =>
      conversation.conversationKey !== updated.conversationKey,
  );
  return conversationsByRecency([...others, updated]);
}

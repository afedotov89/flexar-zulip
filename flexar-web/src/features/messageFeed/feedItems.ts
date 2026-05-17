// Flexar Hub Web — feed row derivation (Phase 1.6).
//
// Pure logic that turns the feed's ordered list of messages into the
// flat list of *rows* the virtualizer renders. Three row kinds are
// interleaved:
//
//   - `recipient-bar`  — a sticky header starting each conversation
//                        block (a run of messages with the same
//                        recipient: channel+topic, or DM participant
//                        set). A new bar is emitted whenever the
//                        recipient changes going down the list.
//   - `date-separator` — emitted between two messages that fall on
//                        different calendar days (viewer-local).
//   - `message`        — one message, carrying `isGroupStart`: whether
//                        it begins a new sender-group within its
//                        conversation block (first message shows
//                        avatar + name + time; followers are collapsed).
//
// Grouping rule: consecutive messages collapse into one group when they
// share a recipient block AND the same sender AND are within
// `GROUP_WINDOW_SECONDS` of the previous message. A recipient change or
// a date boundary always forces a new group (and the bar / separator
// resets the "previous message" context).
//
// This is the single source of truth for the feed's visual structure,
// kept pure and exhaustively unit-tested (`./feedItems.test.ts`); the
// virtualized list component just maps `FeedRow[]` to elements.

import type { Message, MessageId, UnixTimestamp } from "../../domain";

/**
 * Consecutive messages from the same sender within this many seconds of
 * each other (and the same recipient block) collapse into one group.
 * Five minutes is the conventional chat-grouping window.
 */
export const GROUP_WINDOW_SECONDS = 5 * 60;

/** A recipient-bar row: the header of a conversation block. */
export interface RecipientBarRow {
  kind: "recipient-bar";
  /** Stable row key, unique within the row list. */
  key: string;
  /** The recipient this block belongs to. */
  recipient: FeedRecipient;
}

/** A date-separator row between two messages on different days. */
export interface DateSeparatorRow {
  kind: "date-separator";
  /** Stable row key, unique within the row list. */
  key: string;
  /** Start-of-day timestamp (viewer-local) of the day that follows. */
  dayStart: UnixTimestamp;
}

/** A single message row. */
export interface MessageRow {
  kind: "message";
  /** Stable row key — the message id stringified. */
  key: string;
  /** The message id; the row reads the body from `messagesStore`. */
  messageId: MessageId;
  /**
   * Whether this message starts a new sender-group: `true` rows show
   * the avatar + sender name + timestamp header; `false` rows are
   * collapsed followers showing only content (time on hover).
   */
  isGroupStart: boolean;
}

/** One row in the rendered feed. */
export type FeedRow = RecipientBarRow | DateSeparatorRow | MessageRow;

/**
 * The recipient of a conversation block — what a recipient bar labels.
 * `channel` blocks carry the channel id + topic; `dm` blocks carry the
 * sorted participant ids.
 */
export type FeedRecipient =
  | { type: "channel"; streamId: number; topic: string }
  | { type: "dm"; participantIds: number[] };

// Derive the recipient of a single message.
function recipientOf(message: Message): FeedRecipient {
  if (message.type === "stream") {
    return {
      type: "channel",
      // A channel message always carries `stream_id`; fall back to 0
      // defensively so the type stays a clean `number`.
      streamId: message.stream_id ?? 0,
      topic: message.subject,
    };
  }
  const participantIds = Array.isArray(message.display_recipient)
    ? message.display_recipient.map((participant) => participant.id)
    : [];
  return {
    type: "dm",
    participantIds: [...participantIds].sort((a, b) => a - b),
  };
}

/** Whether two recipients address the same conversation block. */
export function sameRecipient(a: FeedRecipient, b: FeedRecipient): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "channel" && b.type === "channel") {
    return a.streamId === b.streamId && a.topic === b.topic;
  }
  if (a.type === "dm" && b.type === "dm") {
    return (
      a.participantIds.length === b.participantIds.length &&
      a.participantIds.every((id, i) => id === b.participantIds[i])
    );
  }
  return false;
}

// A stable key fragment identifying a recipient, used in row keys.
function recipientKey(recipient: FeedRecipient): string {
  return recipient.type === "channel"
    ? `c${recipient.streamId}:${recipient.topic}`
    : `d${recipient.participantIds.join(",")}`;
}

/**
 * Start-of-day (00:00:00) for a Unix timestamp, in the viewer's local
 * timezone, returned as a Unix timestamp. Used both to detect day
 * boundaries and as the `date-separator` row's value.
 */
export function startOfLocalDay(timestamp: UnixTimestamp): UnixTimestamp {
  const date = new Date(timestamp * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Build the flat row list for a feed window.
 *
 * `messages` must be in ascending chronological order (the feed's id
 * list resolved to bodies) — the order the feed renders top to bottom.
 * Messages whose id could not be resolved to a body should be filtered
 * out by the caller before calling this.
 *
 * Recipient bars are emitted only when there is more than one
 * distinct (channel, topic) / DM in the feed — bars exist to
 * separate distinct conversations, so a feed that already pins on
 * exactly one needs no separator (the persistent NarrowHeader
 * already names it). This covers channel+topic narrows and DMs by
 * construction; it also covers a channel-only narrow when the
 * channel currently has just one active topic (where a single bar
 * would duplicate NarrowHeader's `# channel` with `# channel >
 * topic` — same info, twice).
 */
export function buildFeedRows(messages: readonly Message[]): FeedRow[] {
  // One pre-pass to decide whether bars carry any signal. Cheap —
  // we iterate once more below anyway, and Set lookups dominate the
  // string concat in `recipientKey`.
  const distinctRecipients = new Set<string>();
  for (const message of messages) {
    distinctRecipients.add(recipientKey(recipientOf(message)));
  }
  const includeRecipientBars = distinctRecipients.size > 1;

  const rows: FeedRow[] = [];

  let prevMessage: Message | undefined;
  let prevRecipient: FeedRecipient | undefined;
  let prevDayStart: UnixTimestamp | undefined;

  for (const message of messages) {
    const recipient = recipientOf(message);
    const dayStart = startOfLocalDay(message.timestamp);

    const recipientChanged =
      prevRecipient === undefined || !sameRecipient(prevRecipient, recipient);
    const dayChanged = prevDayStart === undefined || prevDayStart !== dayStart;

    // A date separator precedes the first message of a new day, but not
    // before the very first row — the feed's top needs no separator.
    if (dayChanged && prevMessage !== undefined) {
      rows.push({
        kind: "date-separator",
        key: `date:${dayStart}`,
        dayStart,
      });
    }

    // A recipient bar starts every conversation block — unless the
    // caller has opted out because a wrapping header already says
    // the same thing.
    if (recipientChanged && includeRecipientBars) {
      rows.push({
        kind: "recipient-bar",
        key: `bar:${recipientKey(recipient)}:${message.id}`,
        recipient,
      });
    }

    // A message begins a new sender-group unless it continues the
    // previous one: same recipient block, same sender, and within the
    // grouping window. A recipient change or a day change always breaks
    // the group.
    const continuesGroup =
      !recipientChanged &&
      !dayChanged &&
      prevMessage !== undefined &&
      prevMessage.sender_id === message.sender_id &&
      message.timestamp - prevMessage.timestamp <= GROUP_WINDOW_SECONDS;

    rows.push({
      kind: "message",
      key: String(message.id),
      messageId: message.id,
      isGroupStart: !continuesGroup,
    });

    prevMessage = message;
    prevRecipient = recipient;
    prevDayStart = dayStart;
  }

  return rows;
}

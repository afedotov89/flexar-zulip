// Messages and their associated sub-shapes (edit history, topic links,
// display recipients, message flags).

import type { Reaction } from "./emoji";
import type { MessageId, StreamId, UnixTimestamp, UserId } from "./primitives";

/** Whether a message went to a channel or to a set of users directly. */
export type MessageType = "stream" | "private";

/**
 * One participant in a direct-message conversation, as listed in a
 * direct message's `display_recipient` array.
 */
export interface DirectMessageRecipient {
  id: UserId;
  email: string;
  full_name: string;
  /** Whether this is a mirror-dummy placeholder account. */
  is_mirror_dummy: boolean;
}

/**
 * The recipient of a message: a channel name string for channel
 * messages, or an array of participants for direct messages.
 */
export type DisplayRecipient = string | DirectMessageRecipient[];

/**
 * A linkified span generated from the message topic by a custom
 * linkifier — the matched text and the URL it expands to.
 */
export interface TopicLink {
  text: string;
  url: string;
}

/**
 * One entry in a message's edit history, newest first. Which optional
 * fields are present depends on what the edit changed (content, topic,
 * and/or channel); `user_id` and `timestamp` are always present.
 */
export interface MessageEdit {
  /** Editor's user ID; `null` for pre-2017 history entries. */
  user_id: UserId | null;
  timestamp: UnixTimestamp;
  /** Content before this edit; present only on content edits. */
  prev_content?: string;
  /** Rendered HTML of `prev_content`; present only on content edits. */
  prev_rendered_content?: string;
  /** Topic before this edit; present only on topic edits. */
  prev_topic?: string;
  /** Topic after this edit; present only on topic edits. */
  topic?: string;
  /** Channel ID before this edit; present only on channel moves. */
  prev_stream?: StreamId;
  /** Channel ID after this edit; present only on channel moves. */
  stream?: StreamId;
}

/**
 * A Zulip message. This is the canonical shape used both for fetched
 * message history and for the `message` payload of a realtime `message`
 * event.
 *
 * Note the legacy field names: `subject` is the topic, and `type`
 * distinguishes channel from direct messages.
 */
export interface Message {
  id: MessageId;
  /** `"stream"` for channel messages, `"private"` for direct messages. */
  type: MessageType;
  /**
   * Message body. HTML when fetched with markdown applied, otherwise
   * Markdown source. Treat HTML as untrusted, message-grade content.
   */
  content: string;
  /** MIME type of `content`: `text/html` or `text/x-markdown`. */
  content_type: string;
  /** The topic. Legacy field name; always `""` for direct messages. */
  subject: string;
  /** Linkified spans extracted from the topic. */
  topic_links: TopicLink[];
  /** Channel ID; present only for channel messages. */
  stream_id?: StreamId;
  /** Channel name or DM participant list, depending on `type`. */
  display_recipient: DisplayRecipient;
  /** Opaque ID of the recipient set, useful as a conversation key. */
  recipient_id: number;
  sender_id: UserId;
  sender_email: string;
  sender_full_name: string;
  /** Short identifier of the sender's organization. */
  sender_realm_str: string;
  /** Sender's avatar URL; see `User.avatar_url` for `null` semantics. */
  avatar_url: string | null;
  /** When the message was sent. */
  timestamp: UnixTimestamp;
  /** Identifying string of the client that sent the message. */
  client: string;
  /** Whether this is a `/me` status message. */
  is_me_message: boolean;
  /** Reactions on the message, oldest first. */
  reactions: Reaction[];
  /** Data for experimental submessage-based widgets. */
  submessages: Submessage[];
  /**
   * Edit/move history, newest first. Absent if the message was never
   * edited or moved, or if edit-history viewing is disabled.
   */
  edit_history?: MessageEdit[];
  /** When the content was last edited; absent if never edited. */
  last_edit_timestamp?: UnixTimestamp;
  /** When the message was last moved; absent if never moved. */
  last_moved_timestamp?: UnixTimestamp;
}

/**
 * An experimental submessage used by interactive widgets such as
 * `/poll`. The `content` field carries widget-specific JSON.
 */
export interface Submessage {
  id: number;
  message_id: MessageId;
  sender_id: UserId;
  /** Widget message kind, e.g. `widget`. */
  msg_type: string;
  /** Widget-specific payload, typically a JSON string. */
  content: string;
}

/**
 * Per-user message flags (read, starred, mentioned, …). The set of
 * possible flag strings grows over time, so this is intentionally a
 * loose string array rather than a closed union.
 */
export type MessageFlag = string;

// Request-parameter and response-envelope shapes that belong to the API
// boundary itself rather than the domain.
//
// Domain entities (`Message`, `Stream`, `User`, …) come from
// `src/domain`. What lives here is the envelopes the REST endpoints wrap
// those entities in (pagination metadata, the register-queue bootstrap
// payload, narrow/anchor request options) — shapes the domain layer
// deliberately does not model because they are transport concerns.

import type {
  Message,
  MessageFlag,
  MessageId,
  Narrow,
  ServerEvent,
  Stream,
  Subscription,
  Topic,
  UnixTimestamp,
  User,
  UserId,
} from "../domain";

/** Credentials the client attaches to authenticated requests. */
export interface Credentials {
  /** Zulip API email address of the account. */
  email: string;
  /** API key obtained from `fetchApiKey` (or configured out-of-band). */
  apiKey: string;
}

/** Response of `POST /api/v1/fetch_api_key`. */
export interface ApiKeyResult {
  apiKey: string;
  email: string;
  /** User ID of the account; present on modern servers. */
  userId?: UserId;
}

/**
 * Anchor for `getMessages`: either an explicit message ID or one of the
 * server-computed string anchors.
 */
export type MessageAnchor =
  | number
  | "newest"
  | "oldest"
  | "first_unread";

/** Options for `getMessages` (`GET /api/v1/messages`). */
export interface GetMessagesOptions {
  /** Where to anchor the fetch. Defaults to `"newest"`. */
  anchor?: MessageAnchor;
  /** Number of messages older than the anchor to fetch. */
  numBefore: number;
  /** Number of messages newer than the anchor to fetch. */
  numAfter: number;
  /** Narrow filter; omitted fetches the combined feed. */
  narrow?: Narrow;
  /** Whether the anchor message itself should be included. */
  includeAnchor?: boolean;
  /** Request rendered HTML (`true`) or Markdown source (`false`). */
  applyMarkdown?: boolean;
}

/** Response envelope of `GET /api/v1/messages`. */
export interface GetMessagesResult {
  messages: Message[];
  /** The anchor the server actually used. */
  anchor: number;
  /** Whether the batch reaches the newest matching message. */
  foundNewest: boolean;
  /** Whether the batch reaches the oldest matching message. */
  foundOldest: boolean;
  /** Whether the anchor message is present in `messages`. */
  foundAnchor: boolean;
  /** Whether history was truncated due to plan restrictions. */
  historyLimited: boolean;
}

/** Recipient + content for `sendMessage` (`POST /api/v1/messages`). */
export type SendMessageParams =
  | {
      type: "channel";
      /** Channel name or ID. */
      to: string | number;
      topic: string;
      content: string;
    }
  | {
      type: "direct";
      /** User IDs of the direct-message recipients. */
      to: UserId[];
      content: string;
    };

/** Response of `POST /api/v1/messages`. */
export interface SendMessageResult {
  /** ID assigned to the newly sent message. */
  id: number;
}

/** Response of `POST /api/v1/messages/render`. */
export interface RenderMarkdownResult {
  /** Server-rendered HTML for the supplied Markdown. */
  rendered: string;
}

/**
 * Which messages an `editMessage` topic / channel move applies to. Only
 * the default `"change_one"` is valid for content-only edits — Zulip
 * rejects `"change_later"` / `"change_all"` when no topic / stream
 * change is requested.
 */
export type EditMessagePropagateMode =
  | "change_one"
  | "change_later"
  | "change_all";

/**
 * Parameters for `editMessage` (`PATCH /api/v1/messages/{message_id}`).
 *
 * All fields are optional. Phase 3.3 only sets `content`; `topic` /
 * `propagateMode` / the notification flags are scaffolded for later
 * move-message work and otherwise unused.
 */
export interface EditMessageParams {
  /** New message content (Markdown source). Omitted on a pure topic move. */
  content?: string;
  /** New topic name. Omitted unless moving the message to a different topic. */
  topic?: string;
  /** Which messages a topic / channel change propagates to. */
  propagateMode?: EditMessagePropagateMode;
  /** Whether to leave a notification message in the old topic. */
  sendNotificationToOldThread?: boolean;
  /** Whether to leave a notification message in the new topic. */
  sendNotificationToNewThread?: boolean;
}

/**
 * Response envelope of `PATCH /api/v1/messages/{message_id}`.
 *
 * Phase 3.3 does not need any of the body fields beyond the success
 * envelope itself, so this is a deliberately empty shape — the success
 * promise resolution carries all the information the caller needs.
 */
export type EditMessageResult = Record<string, never>;

/** Response envelope of `DELETE /api/v1/messages/{message_id}`. */
export type DeleteMessageResult = Record<string, never>;

/**
 * Parameters for `updateMessageFlags`
 * (`POST /api/v1/messages/flags`). Add or remove a single flag (e.g.
 * `"read"`, `"starred"`) on the listed messages.
 */
export interface UpdateMessageFlagsParams {
  op: "add" | "remove";
  /** The flag to add or remove (e.g. `"read"`, `"starred"`). */
  flag: MessageFlag;
  /** IDs of the messages whose flags are being updated. */
  messages: MessageId[];
}

/** Response envelope of `POST /api/v1/messages/flags`. */
export interface UpdateMessageFlagsResult {
  /** IDs of the messages the server actually updated. */
  messages: MessageId[];
}

/**
 * Response envelope of the bulk mark-as-read endpoints
 * (`POST /api/v1/mark_all_as_read`, `POST /api/v1/mark_stream_as_read`,
 * `POST /api/v1/mark_topic_as_read`).
 *
 * On modern servers (feature level 153+) the operation is asynchronous:
 * the server begins a background job and returns the job's identifier.
 * Older servers complete the work synchronously and return only the
 * `result: success` envelope. The id is exposed for completeness — the
 * UI does not need it (a subsequent `update_message_flags` event with
 * `op:add flag:read all:true` reconciles the state) — and is optional.
 */
export interface MarkAsReadResult {
  /** Background-job id when the server runs the mark asynchronously. */
  partiallyCompletedId?: number;
}

/**
 * Response of `GET /api/v1/messages/{message_id}/history`. The
 * server-side shape carries every modified field per edit; the
 * domain `MessageEdit` already models the union of fields a snapshot
 * may carry.
 */
export interface GetMessageHistoryResult {
  message_history: import("../domain").MessageEdit[];
}

/**
 * Parameters for `sendTyping` (`POST /api/v1/typing`). Discriminated
 * on `type`: a direct conversation carries the `to` list of recipient
 * user ids; a channel typing event carries `streamId` + `topic`.
 *
 * `op` is `"start"` when the user has begun typing and `"stop"` when
 * they've finished or backed out. The dispatcher emits `start` once
 * per typing burst and `stop` after a debounce — see `ComposeBox`.
 */
export type SendTypingParams =
  | {
      op: "start" | "stop";
      type: "direct";
      /** Recipient user ids for the DM conversation. */
      to: UserId[];
    }
  | {
      op: "start" | "stop";
      type: "stream";
      streamId: number;
      topic: string;
    };

/**
 * Response of `GET /api/v1/messages/{message_id}` with
 * `apply_markdown=false`.
 *
 * The server returns both the modern `message` envelope (with `content`
 * carrying the raw Markdown when `apply_markdown=false`) and the
 * deprecated top-level `raw_content` field. Phase 3.3 only needs the
 * raw Markdown source — `getRawContent` returns it as a string and does
 * not re-expose the rest of this shape.
 */
export interface GetSingleMessageResult {
  message: Message;
  /** The raw Markdown source of the message (deprecated top-level field). */
  raw_content: string;
}

/** Options for `registerQueue` (`POST /api/v1/register`). */
export interface RegisterQueueOptions {
  /**
   * Event types to subscribe the queue to. Omitting this subscribes to
   * every event type — useful for prototyping, wasteful in production.
   */
  eventTypes?: string[];
  /** Event types to fetch initial state for; defaults to `eventTypes`. */
  fetchEventTypes?: string[];
  /** Narrow restricting which `message` events the queue receives. */
  narrow?: Narrow;
  /** Request rendered HTML in fetched/queued message content. */
  applyMarkdown?: boolean;
  /** Whether the client can compute gravatar URLs itself. */
  clientGravatar?: boolean;
  /** Whether channel objects should carry their subscriber lists. */
  includeSubscribers?: boolean | "partial";
  /** Whether `presence` data should use the modern keyed-by-id format. */
  slimPresence?: boolean;
}

/**
 * Response of `POST /api/v1/register`.
 *
 * The register response is large and highly variable: which `realm_*`
 * and initial-state keys are present depends entirely on the
 * `fetchEventTypes` requested. Only the always-present queue bootstrap
 * fields are modelled explicitly; the remainder is exposed through an
 * index signature so callers can read what they asked for. The realtime
 * layer (Phase 1.2) is responsible for interpreting the rest.
 */
export interface RegisterQueueResult {
  /** ID of the allocated queue; `null` only for unauthenticated access. */
  queueId: string | null;
  /** Initial `lastEventId` to pass to `getEvents`. */
  lastEventId: number;
  /** Server feature level. */
  zulipFeatureLevel: number;
  /** Server version string. */
  zulipVersion: string;
  /** Any additional initial-state / `realm_*` keys the server returned. */
  [key: string]: unknown;
}

/** Response of `GET /api/v1/events`. */
export interface GetEventsResult {
  /** Events newer than the requested `lastEventId`, oldest first. */
  events: ServerEvent[];
  /** Queue ID echoed back, when the server includes it. */
  queueId?: string;
}

/** Response of `GET /api/v1/users/me/subscriptions`. */
export interface GetSubscriptionsResult {
  subscriptions: Subscription[];
}

/** Response of `GET /api/v1/streams`. */
export interface GetStreamsResult {
  streams: Stream[];
}

/**
 * Response of `GET /api/v1/users/me/{stream_id}/topics` — the topics in
 * one channel, server-ordered by recency (most recent first). Each
 * entry matches the domain `Topic` shape (`name`, `max_id`).
 */
export interface GetTopicsResult {
  topics: Topic[];
}

/** Response of `GET /api/v1/users`. */
export interface GetUsersResult {
  members: User[];
}

/**
 * Response of `GET /api/v1/users/me` — the authenticated account's own
 * profile. The endpoint returns the same field set as a directory
 * `User`, so the domain `User` type describes it.
 */
export type GetOwnUserResult = User;

/**
 * Parameters for `sendSubmessage` (`POST /api/v1/submessages`). Used
 * by widget messages (poll / todo) to record votes, add options, etc.
 * `content` is widget-specific JSON the server validates against the
 * parent message's widget type.
 */
export interface SendSubmessageParams {
  messageId: number;
  /** Always `"widget"` in the current widget protocol. */
  msgType: string;
  /** JSON string carrying the widget-specific event payload. */
  content: string;
}

/**
 * Parameters for `updateOwnUserStatus`
 * (`POST /api/v1/users/me/status`). Every field is optional and the
 * server only changes the parameters supplied — pass just
 * `statusText` to change the text, just the three emoji fields to
 * change the emoji. Passing the empty string clears the corresponding
 * piece (Zulip's documented signal).
 */
export interface UpdateOwnUserStatusParams {
  /** Status text; up to 60 Unicode code points. `""` clears it. */
  statusText?: string;
  /** Status emoji name; `""` clears the emoji. */
  emojiName?: string;
  /** Server emoji code matching `emojiName`. */
  emojiCode?: string;
  /** Emoji namespace (`unicode_emoji` / `realm_emoji` / `zulip_extra_emoji`). */
  reactionType?: string;
}

/**
 * Parameters for `createScheduledMessage`
 * (`POST /api/v1/scheduled_messages`). Discriminated on `type`: a
 * channel-bound scheduled message carries the destination channel id
 * and topic; a direct-message scheduled message carries the list of
 * recipient user ids. The wire `type` accepts both `direct` and the
 * legacy `private`; we send `direct` (the modern label) per the API
 * docs' recommendation.
 */
export type CreateScheduledMessageParams =
  | {
      type: "channel";
      /** Destination channel id. */
      to: number;
      topic: string;
      content: string;
      /** Unix seconds (UTC) when the server should attempt delivery. */
      scheduledDeliveryTimestamp: UnixTimestamp;
    }
  | {
      type: "direct";
      /** Recipient user ids. */
      to: UserId[];
      content: string;
      /** Unix seconds (UTC) when the server should attempt delivery. */
      scheduledDeliveryTimestamp: UnixTimestamp;
    };

/** Response of `POST /api/v1/scheduled_messages`. */
export interface CreateScheduledMessageResult {
  /** Server-assigned id of the new scheduled message. */
  scheduledMessageId: number;
}

/**
 * Parameters for `updateScheduledMessage`
 * (`PATCH /api/v1/scheduled_messages/{scheduled_message_id}`). Every
 * field is optional — pass only what changed. Updating a scheduled
 * message that already failed to send requires
 * `scheduledDeliveryTimestamp`; the UI enforces this at call sites.
 */
export interface UpdateScheduledMessageParams {
  /** New destination kind; carries its own required-field rules. */
  type?: "channel" | "direct";
  /** New destination — channel id, or recipient user ids. */
  to?: number | UserId[];
  topic?: string;
  content?: string;
  scheduledDeliveryTimestamp?: UnixTimestamp;
}


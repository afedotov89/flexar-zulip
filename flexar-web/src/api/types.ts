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
  Narrow,
  ServerEvent,
  Stream,
  Subscription,
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

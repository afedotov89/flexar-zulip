// Realtime events.
//
// After registering an event queue, a client long-polls `GET /events`
// and receives an ordered array of event objects. Every event has a
// numeric `id` and a `type`; many also carry an `op` sub-discriminator.
// `ServerEvent` is the discriminated union of the event shapes a chat
// client acts on.
//
// The server defines ~45 event types. Modelling every one precisely
// would be a large surface that mostly the API/realtime layers never
// branch on. This file gives precise shapes for the events that drive
// the core chat experience (messages, edits, deletions, reactions,
// flags, subscriptions, channels, presence, typing, user directory,
// user status/topic) and falls back to `UnknownEvent` for the long
// tail. `ServerEvent` therefore stays a closed union for `switch`
// exhaustiveness while still accepting any event the server sends.

import type { ReactionType } from "./emoji";
import type {
  Message,
  MessageFlag,
  MessageType,
  TopicLink,
} from "./message";
import type {
  GroupSettingValue,
  MessageId,
  StreamId,
  UnixTimestamp,
  UserId,
} from "./primitives";
import type { Stream, Subscription, TopicVisibilityPolicy } from "./stream";
import type { Presence, PresenceMap, User } from "./user";

/** Fields present on every event delivered through the queue. */
interface EventBase {
  /**
   * Monotonically increasing queue event ID. Increasing but not
   * necessarily consecutive; pass the highest seen as `last_event_id`.
   */
  id: number;
}

/** New message received. */
export interface MessageEvent extends EventBase {
  type: "message";
  message: Message;
  /** The current user's flags for this message (e.g. `mentioned`). */
  flags: MessageFlag[];
  /**
   * Echo of the client-chosen `local_id`, present only for messages
   * this client sent with local echo enabled.
   */
  local_message_id?: string;
}

/**
 * A message was edited, moved, and/or had its rendered content
 * refreshed. Which optional fields appear depends on what changed;
 * `rendering_only` distinguishes a pure re-render (e.g. an inline URL
 * preview) from a user-initiated edit.
 */
export interface UpdateMessageEvent extends EventBase {
  type: "update_message";
  /** Editor's user ID; `null` for rendering-only updates. */
  user_id: UserId | null;
  /** Whether this event only refreshes rendered content. */
  rendering_only: boolean;
  /** The edited message; content changes apply to this ID only. */
  message_id: MessageId;
  /** All messages a channel/topic move applies to; includes `message_id`. */
  message_ids: MessageId[];
  /** The current user's flags for `message_id` after the edit. */
  flags: MessageFlag[];
  /** When the edit was processed by the server. */
  edit_timestamp: UnixTimestamp;
  /** Pre-edit channel name; present for channel-message edits. */
  stream_name?: string;
  /** Pre-edit channel ID; present for channel-message edits. */
  stream_id?: StreamId;
  /** Post-move channel ID; present only when messages changed channel. */
  new_stream_id?: StreamId;
  /** How far the topic/channel move propagated. */
  propagate_mode?: "change_one" | "change_later" | "change_all";
  /** Pre-edit topic; present only on topic/channel moves. */
  orig_subject?: string;
  /** Post-edit topic; present only when the topic name changed. */
  subject?: string;
  /** Linkified spans of the post-edit topic. */
  topic_links?: TopicLink[];
  /** Pre-edit Markdown source; present only on content edits. */
  orig_content?: string;
  /** Pre-edit rendered HTML; present only on content edits. */
  orig_rendered_content?: string;
  /** Post-edit Markdown source; present on content edits and re-renders. */
  content?: string;
  /** Post-edit rendered HTML; present on content edits and re-renders. */
  rendered_content?: string;
  /** Whether the message is a `/me` message after the edit. */
  is_me_message?: boolean;
}

/**
 * One or more messages were deleted, or the current user lost access to
 * them. `message_ids` is sent to clients with the `bulk_message_deletion`
 * capability; otherwise the singular `message_id` is sent.
 */
export interface DeleteMessageEvent extends EventBase {
  type: "delete_message";
  message_type: MessageType;
  /** Sorted IDs of deleted messages (bulk-capable clients). */
  message_ids?: MessageId[];
  /** Single deleted message ID (non-bulk clients). */
  message_id?: MessageId;
  /** Channel ID; present only when `message_type` is `stream`. */
  stream_id?: StreamId;
  /** Topic; present only when `message_type` is `stream`. */
  topic?: string;
}

/** A reaction was added to or removed from a message. */
export interface ReactionEvent extends EventBase {
  type: "reaction";
  op: "add" | "remove";
  message_id: MessageId;
  /** The user who added or removed the reaction. */
  user_id: UserId;
  emoji_name: string;
  emoji_code: string;
  reaction_type: ReactionType;
}

/**
 * A message flag was added or removed for the current user. `all` is
 * meaningful only for the `read` flag on `op: "add"`: when `true`, the
 * flag was applied to every message and `messages` is empty.
 */
export interface UpdateMessageFlagsEvent extends EventBase {
  type: "update_message_flags";
  op: "add" | "remove";
  /** The flag that changed. */
  flag: MessageFlag;
  /** IDs of the affected messages. */
  messages: MessageId[];
  /** Whether the flag was applied to all messages (see above). */
  all: boolean;
}

/** The current user was subscribed to one or more channels. */
export interface SubscriptionAddEvent extends EventBase {
  type: "subscription";
  op: "add";
  subscriptions: Subscription[];
}

/** The current user was unsubscribed from one or more channels. */
export interface SubscriptionRemoveEvent extends EventBase {
  type: "subscription";
  op: "remove";
  subscriptions: Array<{ stream_id: StreamId; name: string }>;
}

/**
 * A personal property of one of the current user's subscriptions
 * changed (e.g. `color`, `is_muted`, `pin_to_top`). `property` is
 * intentionally a loose string since the server may add new ones.
 */
export interface SubscriptionUpdateEvent extends EventBase {
  type: "subscription";
  op: "update";
  stream_id: StreamId;
  property: string;
  value: number | boolean | string;
}

/** Another user became visible as a subscriber of some channels. */
export interface SubscriptionPeerAddEvent extends EventBase {
  type: "subscription";
  op: "peer_add";
  stream_ids: StreamId[];
  user_ids: UserId[];
}

/** Other users were unsubscribed from some channels. */
export interface SubscriptionPeerRemoveEvent extends EventBase {
  type: "subscription";
  op: "peer_remove";
  stream_ids: StreamId[];
  user_ids: UserId[];
}

/** All `subscription` event variants. */
export type SubscriptionEvent =
  | SubscriptionAddEvent
  | SubscriptionRemoveEvent
  | SubscriptionUpdateEvent
  | SubscriptionPeerAddEvent
  | SubscriptionPeerRemoveEvent;

/** The current user gained visibility of newly-created channels. */
export interface StreamCreateEvent extends EventBase {
  type: "stream";
  op: "create";
  streams: Stream[];
}

/** The current user lost visibility of channels (e.g. archived). */
export interface StreamDeleteEvent extends EventBase {
  type: "stream";
  op: "delete";
  streams: Stream[];
}

/**
 * A global property of a channel changed. `property` is a loose string
 * for forward compatibility; `value` covers the scalar and
 * group-setting-value shapes the server sends.
 */
export interface StreamUpdateEvent extends EventBase {
  type: "stream";
  op: "update";
  stream_id: StreamId;
  name: string;
  property: string;
  value: number | boolean | string | null | GroupSettingValue;
  /** Present only when the changed property was `description`. */
  rendered_description?: string;
  /** Present only when the changed property was `invite_only`. */
  history_public_to_subscribers?: boolean;
  /** Present only when the changed property was `invite_only`. */
  is_web_public?: boolean;
}

/** All `stream` event variants. */
export type StreamEvent =
  | StreamCreateEvent
  | StreamDeleteEvent
  | StreamUpdateEvent;

/** A new user joined, or a guest gained access to a user. */
export interface RealmUserAddEvent extends EventBase {
  type: "realm_user";
  op: "add";
  person: User;
}

/** A guest lost access to a user, or a user was deactivated. */
export interface RealmUserRemoveEvent extends EventBase {
  type: "realm_user";
  op: "remove";
  person: {
    user_id: UserId;
    full_name: string;
  };
}

/**
 * A property of an existing user changed. `person` always carries the
 * user ID plus whichever fields were updated, so it is modelled as a
 * partial `User` with a required `user_id`.
 */
export interface RealmUserUpdateEvent extends EventBase {
  type: "realm_user";
  op: "update";
  person: Partial<User> & { user_id: UserId };
}

/** All `realm_user` event variants. */
export type RealmUserEvent =
  | RealmUserAddEvent
  | RealmUserRemoveEvent
  | RealmUserUpdateEvent;

/**
 * A user came back online. Clients with the `simplified_presence_events`
 * capability receive `presences`; older clients receive the legacy
 * `user_id` + `presence` fields instead.
 */
export interface PresenceEvent extends EventBase {
  type: "presence";
  /** Modern format: map of user ID to presence (capability-gated). */
  presences?: PresenceMap;
  /** Legacy format: the user whose presence changed. */
  user_id?: UserId;
  /** Legacy format: when the server received the presence. */
  server_timestamp?: number;
  /** Legacy format: the user's presence keyed by client name. */
  presence?: Record<string, Presence>;
}

/** Identity of a user referenced in a typing event. */
export interface TypingEventUser {
  user_id: UserId;
  email: string;
}

/**
 * A user started or stopped typing. For direct messages `recipients`
 * lists the conversation participants; for channel messages `stream_id`
 * and `topic` identify the destination.
 */
export interface TypingEvent extends EventBase {
  type: "typing";
  op: "start" | "stop";
  message_type: "direct" | "stream";
  sender: TypingEventUser;
  /** Present only when `message_type` is `direct`. */
  recipients?: TypingEventUser[];
  /** Present only when `message_type` is `stream`. */
  stream_id?: StreamId;
  /** Present only when `message_type` is `stream`. */
  topic?: string;
}

/** A user's status text and/or status emoji changed. */
export interface UserStatusEvent extends EventBase {
  type: "user_status";
  user_id: UserId;
  /** Status text; `""` when the user set a status without text. */
  status_text?: string;
  /** Status emoji name; `""` when no emoji was selected. */
  emoji_name?: string;
  /** Status emoji code; `""` when no emoji was selected. */
  emoji_code?: string;
  reaction_type?: ReactionType;
  /** Legacy mirror of the user's `presence_enabled` setting. */
  away?: boolean;
}

/** The current user changed their per-topic visibility preference. */
export interface UserTopicEvent extends EventBase {
  type: "user_topic";
  stream_id: StreamId;
  topic_name: string;
  /** When the user-topic relationship was last changed. */
  last_updated: UnixTimestamp;
  visibility_policy: TopicVisibilityPolicy;
}

/** Periodic keepalive sent when the queue has no events to deliver. */
export interface HeartbeatEvent extends EventBase {
  type: "heartbeat";
}

/**
 * Fallback for any event type this layer does not model precisely.
 * Keeps `ServerEvent` open to the full set of server events while
 * preserving discriminated-union narrowing for the modelled ones.
 * `type` is deliberately broad; consumers branch on the known literals
 * first and treat the rest as `UnknownEvent`.
 */
export interface UnknownEvent extends EventBase {
  type: string;
  op?: string;
  [key: string]: unknown;
}

/**
 * The discriminated union of realtime events. Narrow on `type` (and
 * `op` where present); the `UnknownEvent` member absorbs every event
 * type not given a precise shape above.
 */
export type ServerEvent =
  | MessageEvent
  | UpdateMessageEvent
  | DeleteMessageEvent
  | ReactionEvent
  | UpdateMessageFlagsEvent
  | SubscriptionEvent
  | StreamEvent
  | RealmUserEvent
  | PresenceEvent
  | TypingEvent
  | UserStatusEvent
  | UserTopicEvent
  | HeartbeatEvent
  | UnknownEvent;

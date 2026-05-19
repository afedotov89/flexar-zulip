// Channels (Zulip's API still calls them "streams"), the current
// user's subscriptions to them, and topics within them.

import type {
  GroupSettingValue,
  MessageId,
  StreamId,
  UnixTimestamp,
  UserId,
} from "./primitives";

/**
 * Per-topic visibility preference a user can set:
 * - `None` — no special policy.
 * - `Muted` — topic is muted.
 * - `Unmuted` — topic is explicitly unmuted within a muted channel.
 * - `Followed` — topic is followed.
 */
export const TopicVisibilityPolicy = {
  None: 0,
  Muted: 1,
  Unmuted: 2,
  Followed: 3,
} as const;
export type TopicVisibilityPolicy =
  (typeof TopicVisibilityPolicy)[keyof typeof TopicVisibilityPolicy];

/**
 * Per-channel topics policy. `inherit` defers to the realm-level
 * `realm_disable_empty_topic` setting; the explicit values override it for
 * this channel. `empty_topic_only` is the "no topics, single thread"
 * shape (Slack/Telegram-style chat); `allow_empty_topic` is the mixed
 * mode where a topic is optional.
 */
export type ChannelTopicsPolicy =
  | "inherit"
  | "disable_empty_topic"
  | "allow_empty_topic"
  | "empty_topic_only";

/**
 * The set of `can_*_group` permission fields shared by channel and
 * subscription objects. Each is a group-setting value naming who holds
 * the permission. They are grouped here because the server adds new
 * ones over time and several endpoints omit a varying subset.
 */
export interface ChannelPermissionGroups {
  can_add_subscribers_group?: GroupSettingValue;
  can_remove_subscribers_group?: GroupSettingValue;
  can_administer_channel_group?: GroupSettingValue;
  can_delete_any_message_group?: GroupSettingValue;
  can_delete_own_message_group?: GroupSettingValue;
  can_move_messages_out_of_channel_group?: GroupSettingValue;
  can_move_messages_within_channel_group?: GroupSettingValue;
  can_send_message_group?: GroupSettingValue;
  can_subscribe_group?: GroupSettingValue;
  can_resolve_topics_group?: GroupSettingValue;
  can_create_topic_group?: GroupSettingValue;
}

/**
 * Fields describing a channel itself, independent of whether the
 * current user is subscribed. `Stream` and `Subscription` both build on
 * this; the latter adds the viewer's personal settings.
 */
export interface ChannelBase extends ChannelPermissionGroups {
  stream_id: StreamId;
  name: string;
  /** Channel description in Zulip-flavored Markdown source form. */
  description: string;
  /** `description` rendered to HTML; treat as message-grade HTML. */
  rendered_description: string;
  /** Whether the channel has been archived. */
  is_archived: boolean;
  /** `true` for a private (invite-only) channel. */
  invite_only: boolean;
  /** `true` when message history is readable by unauthenticated visitors. */
  is_web_public: boolean;
  /** Whether channel history is visible to newly-added subscribers. */
  history_public_to_subscribers: boolean;
  /** Creator's user ID, or `null` when there is no recorded creator. */
  creator_id: UserId | null;
  /**
   * Message-retention window in days; `null` inherits the
   * organization default, `-1` retains messages forever.
   */
  message_retention_days: number | null;
  /** ID of the first message ever sent here; `null` if none. */
  first_message_id: number | null;
  /** ID of the channel folder this channel belongs to, or `null`. */
  folder_id: number | null;
  /** Estimated messages per week, or `null` when not provided. */
  stream_weekly_traffic: number | null;
  /** Count of non-deactivated subscribers, maintained from peer events. */
  subscriber_count: number;
  /**
   * Per-channel topics policy. Absent (or `"inherit"`) means defer to
   * the realm-level `realm_disable_empty_topic` setting; the explicit
   * values override it for this channel only.
   */
  topics_policy?: ChannelTopicsPolicy;
}

/**
 * A channel as seen in channel-listing contexts and `stream` create
 * events. Adds creation metadata and an activity hint on top of
 * `ChannelBase`.
 */
export interface Stream extends ChannelBase {
  /** When the channel was created. */
  date_created: UnixTimestamp;
  /** Whether the channel has had recent message activity. */
  is_recently_active: boolean;
}

/**
 * The current user's subscription to a channel: all of `ChannelBase`
 * plus the viewer's personal per-channel settings (color, mute,
 * notification overrides). A `null` notification override means
 * "inherit the user-level default".
 */
export interface Subscription extends ChannelBase {
  /** When the channel was created. */
  date_created?: UnixTimestamp;
  /** Whether the channel has had recent message activity. */
  is_recently_active?: boolean;
  /** The user's personal display color for this channel. */
  color: string;
  /** Whether the user pinned this channel to the top of the list. */
  pin_to_top: boolean;
  /** Whether the user muted this channel. */
  is_muted: boolean;
  /**
   * Full subscriber user IDs. Present only when subscriber data was
   * requested in full.
   */
  subscribers?: UserId[];
  /**
   * A server-chosen subset of subscribers, sent instead of
   * `subscribers` for very large channels when partial data was
   * requested.
   */
  partial_subscribers?: UserId[];
  desktop_notifications: boolean | null;
  email_notifications: boolean | null;
  push_notifications: boolean | null;
  audible_notifications: boolean | null;
  wildcard_mentions_notify: boolean | null;
}

/**
 * A topic within a channel. Zulip has no standalone topic object; this
 * is the shape returned by the per-channel topic listing, with the
 * channel ID supplied by the caller's context.
 */
export interface Topic {
  /** The topic name. May be the empty string for the "general" topic. */
  name: string;
  /** ID of the most recent message in the topic. */
  max_id: MessageId;
}

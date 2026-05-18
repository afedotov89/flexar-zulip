// Request-parameter and response-envelope shapes that belong to the API
// boundary itself rather than the domain.
//
// Domain entities (`Message`, `Stream`, `User`, …) come from
// `src/domain`. What lives here is the envelopes the REST endpoints wrap
// those entities in (pagination metadata, the register-queue bootstrap
// payload, narrow/anchor request options) — shapes the domain layer
// deliberately does not model because they are transport concerns.

import type {
  GroupSettingValue,
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
 * Parameters for `updateOwnSettings` (`PATCH /api/v1/settings`). The
 * server endpoint accepts a large surface (~80 settings); this type
 * lists the subset Phase 5.1's UI exposes. Adding a setting here is
 * a one-line change — every value is forwarded straight through to
 * the form-encoded body.
 *
 * `fullName` and the password fields are forwarded under their wire
 * names; the rest match the server name (snake_case) so the mapping
 * stays obvious.
 */
export interface UpdateOwnSettingsParams {
  /** New display name for the current user. */
  fullName?: string;
  /** Whether time should be displayed in 24-hour notation. */
  twenty_four_hour_time?: boolean;
  /** Whether the client should play a sound on a new notification. */
  enable_sounds?: boolean;
  /** Whether desktop notifications are enabled. */
  enable_desktop_notifications?: boolean;
  /** Whether the user receives typing notifications from others. */
  receives_typing_notifications?: boolean;
  /** Whether the client should display starred-message counts. */
  starred_message_counts?: boolean;
}

/**
 * Parameters for `subscribe` (`POST /api/v1/users/me/subscriptions`).
 * Each entry in `subscriptions` carries a channel name and an
 * optional description (only used when the channel does not yet
 * exist and the server creates it).
 */
export interface SubscribeParams {
  subscriptions: ReadonlyArray<{ name: string; description?: string }>;
  /** User ids to subscribe instead of (or in addition to) the caller. */
  principals?: ReadonlyArray<UserId>;
  /** Whether private-channel auth errors should fail the request. */
  authorizationErrorsFatal?: boolean;
  /** Whether to announce a newly-created channel. */
  announce?: boolean;
}

/**
 * Parameters for `unsubscribe`
 * (`DELETE /api/v1/users/me/subscriptions`). `subscriptions` is the
 * list of channel names to unsubscribe; `principals` lets an admin
 * unsubscribe other users.
 */
export interface UnsubscribeParams {
  subscriptions: readonly string[];
  principals?: ReadonlyArray<UserId>;
}

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

// --- Admin: realm settings (Phase 5.2) -----------------------------

/**
 * Parameters for `updateRealm` (`PATCH /api/v1/realm`). The server
 * endpoint accepts a large surface (~60 realm settings); this type
 * lists the minimal-set Phase 5.2 exposes. All fields are optional —
 * pass only what changed. Names match the server name (snake_case so
 * the wire mapping stays obvious).
 */
export interface UpdateRealmParams {
  /** Organization name (≤ 40 chars). */
  name?: string;
  /** Organization description (Markdown). */
  description?: string;
  /** Whether members may edit their own messages. */
  allow_message_editing?: boolean;
  /** Edit-time limit, seconds; `0` = unlimited. */
  message_content_edit_limit_seconds?: number;
  /** Delete-time limit, seconds; `0` = unlimited. */
  message_content_delete_limit_seconds?: number;
  /** Realm-wide message retention, in days; `-1` = forever. */
  message_retention_days?: number;
  /** Who can see message edit history (server enum, e.g. `"all_users"`). */
  message_edit_history_visibility_policy?: string;
  /** Whether invitations are required to join. */
  invite_required?: boolean;
  /** Days a new user must wait before having full-member permissions. */
  waiting_period_threshold?: number;
  /** Whether direct image URLs unfurl into inline thumbnails. */
  inline_image_preview?: boolean;
  /** Whether arbitrary links unfurl into Open Graph preview cards. */
  inline_url_embed_preview?: boolean;
}

// --- Admin: channels (Phase 5.3) -----------------------------------

/** Privacy mode for a channel — derives the wire flags. */
export type ChannelPrivacy = "public" | "private" | "web_public";

/**
 * Per-channel topics policy passed to create/update. Wire name is
 * `topics_policy`; we mirror Zulip's enum values verbatim so the
 * type doubles as the wire-level type.
 */
export type ChannelTopicsPolicyParam =
  | "inherit"
  | "disable_empty_topic"
  | "allow_empty_topic"
  | "empty_topic_only";

/**
 * Parameters for `createChannel` (`POST /api/v1/users/me/subscriptions`
 * with subscriber creation flags). Wire-level the create is just a
 * `subscribe` with a new channel name, plus extra privacy/permission
 * fields the server uses to initialise the new channel.
 */
export interface CreateChannelParams {
  name: string;
  description?: string;
  privacy?: ChannelPrivacy;
  /**
   * History setting: whether subscribers added later can see messages
   * sent before their subscription. Defaults to `true` for public
   * channels, `false` for private (Zulip's defaults).
   */
  historyPublicToSubscribers?: boolean;
  /** Initial subscribers (caller is auto-included). */
  principals?: ReadonlyArray<UserId>;
  /** Whether the server should send an announcement message. */
  announce?: boolean;
  /**
   * Per-channel topics policy. Omit (or pass `"inherit"`) to defer to
   * the realm-level setting; the explicit values override it for this
   * channel only.
   */
  topicsPolicy?: ChannelTopicsPolicyParam;
  /**
   * Who is allowed to post — a user-group ID (typically a system group
   * like `role:everyone` / `role:administrators` resolved to its numeric
   * ID via `getUserGroups`). Omit to take the server default.
   */
  canSendMessageGroup?: number;
}

/**
 * Parameters for `updateChannel`
 * (`PATCH /api/v1/streams/{stream_id}`). All fields are optional —
 * server merges. Pass only what changed.
 */
export interface UpdateChannelParams {
  newName?: string;
  description?: string;
  isPrivate?: boolean;
  isWebPublic?: boolean;
  historyPublicToSubscribers?: boolean;
  /** Channel retention; `-1` = forever, `null` = inherit realm. */
  messageRetentionDays?: number | null;
  /**
   * Who can post to this channel — a user-group ID (system groups like
   * "Administrators" or named groups), serialised on the wire as a
   * `GroupSettingChangeRequest`.
   */
  canSendMessageGroup?: number;
  /** Per-channel topics policy override (see `ChannelTopicsPolicyParam`). */
  topicsPolicy?: ChannelTopicsPolicyParam;
}

/**
 * One entry from `GET /api/v1/user_groups` — the full shape the server
 * returns at the current feature level. `members` and
 * `direct_subgroup_ids` carry only the directly-granted memberships
 * (transitive membership is resolved client-side by walking the
 * subgroup graph).
 */
export interface UserGroup {
  id: number;
  /**
   * Internal name. System groups use the `role:*` namespace
   * (`role:everyone`, `role:fullmembers`, `role:moderators`,
   * `role:administrators`, etc.).
   */
  name: string;
  description: string;
  /** `true` for the realm's built-in role-based groups. */
  is_system_group: boolean;
  /** Direct member user IDs (not transitive). */
  members: UserId[];
  /** Direct subgroup IDs (not transitive). */
  direct_subgroup_ids: number[];
  /**
   * Creator's user ID. `null` for system groups and for groups created
   * before the server began recording this field.
   */
  creator_id: UserId | null;
  /**
   * Creation time, unix seconds. `null` for system groups (which are
   * realm-bootstrapped, not user-created).
   */
  date_created: UnixTimestamp | null;
  /** `true` once a group has been deactivated (soft-delete). */
  deactivated: boolean;
  /** Who may add members to this group. */
  can_add_members_group: GroupSettingValue;
  /** Who may join this group voluntarily. */
  can_join_group: GroupSettingValue;
  /** Who may leave this group voluntarily. */
  can_leave_group: GroupSettingValue;
  /** Who may rename, edit, or deactivate this group. */
  can_manage_group: GroupSettingValue;
  /** Who may @-mention this group in messages. */
  can_mention_group: GroupSettingValue;
  /** Who may remove members from this group. */
  can_remove_members_group: GroupSettingValue;
}

/** Response of `GET /api/v1/user_groups`. */
export interface GetUserGroupsResult {
  user_groups: UserGroup[];
}

/**
 * Parameters for `createUserGroup` (`POST /api/v1/user_groups/create`).
 * `members` and `subgroups` are sent as JSON-encoded arrays on the wire.
 */
export interface CreateUserGroupParams {
  name: string;
  description: string;
  /** Initial direct members; an empty array is allowed. */
  members: UserId[];
  /** Initial direct subgroups; defaults to empty. */
  subgroups?: number[];
}

/**
 * Parameters for `updateUserGroup`
 * (`PATCH /api/v1/user_groups/{user_group_id}`) — basic metadata only.
 * Pass only what changed.
 */
export interface UpdateUserGroupParams {
  name?: string;
  description?: string;
  /**
   * Reactivate a previously-deactivated group by passing `false`.
   * There is no separate reactivate endpoint — the deactivate endpoint
   * is one-way and reactivation goes through this edit path.
   */
  deactivated?: boolean;
}

/**
 * Parameters for `updateUserGroupSettings` — same endpoint as
 * `updateUserGroup` (`PATCH /api/v1/user_groups/{user_group_id}`), but
 * for the `can_*_group` permission settings. Each value is sent
 * JSON-encoded as `{new: <GroupSettingValue>}` (Zulip's
 * `GroupSettingChangeRequest` envelope). Kept separate from
 * `UpdateUserGroupParams` so the wire-envelope split stays visible to
 * callers.
 */
export interface UpdateUserGroupSettingsParams {
  canAddMembersGroup?: GroupSettingValue;
  canJoinGroup?: GroupSettingValue;
  canLeaveGroup?: GroupSettingValue;
  canManageGroup?: GroupSettingValue;
  canMentionGroup?: GroupSettingValue;
  canRemoveMembersGroup?: GroupSettingValue;
}

/** Response of `GET /api/v1/streams/{stream_id}/members`. */
export interface GetChannelSubscribersResult {
  subscribers: UserId[];
}

// --- Admin: users (Phase 5.4) --------------------------------------

/**
 * Parameters for `updateUser` (`PATCH /api/v1/users/{user_id}`). All
 * fields optional — pass only what changed. `role` accepts the wire
 * integers (100=owner, 200=admin, 300=moderator, 400=member, 600=guest).
 */
export interface UpdateUserParams {
  fullName?: string;
  role?: number;
  newEmail?: string;
}

/**
 * Parameters for `deactivateUser`
 * (`DELETE /api/v1/users/{user_id}`). All fields optional — the API
 * accepts the bare DELETE for the common case.
 */
export interface DeactivateUserParams {
  /** Comment surfaced in the deactivation notification to the user. */
  deactivationNotificationComment?: string;
  /** Whether to clear the deactivated user's avatar/messages. */
  deleteProfile?: boolean;
  deleteUserMessages?: boolean;
}

// --- Admin: invites (Phase 5.4) ------------------------------------

/** One pending or expired invitation, as returned by `GET /invites`. */
export interface Invite {
  id: number;
  /** When the invite was created (unix seconds). */
  invited: UnixTimestamp;
  /** Whom this invitation was issued to; absent for reusable links. */
  email?: string;
  /** Whether this is a multi-use invite link rather than per-email. */
  is_multiuse: boolean;
  /** Role the invitee will get after redemption (wire integer). */
  invited_as: number;
  /** Inviter's user id. */
  invited_by_user_id?: UserId;
  /** Expiration (unix seconds), or `null` for non-expiring. */
  expiry_date: UnixTimestamp | null;
  /** Whether the invitation link has been used (multi-use invites). */
  link_url?: string;
  /** Stream IDs the invitee gets auto-subscribed to. */
  stream_ids?: number[];
  /** Group IDs the invitee gets added to. */
  group_ids?: number[];
  /** Notifications stream id for the invite. */
  notify_referrer_on_join?: boolean;
}

/** Response of `GET /api/v1/invites`. */
export interface GetInvitesResult {
  invites: Invite[];
}

/**
 * Parameters for `sendInvites` (`POST /api/v1/invites`). `inviteeEmails`
 * is a list — Zulip accepts a comma-or-newline-separated string on the
 * wire; we join here so the call site supplies a clean array.
 */
export interface SendInvitesParams {
  inviteeEmails: readonly string[];
  /** Minutes from now until the invite expires; `null` = never. */
  inviteExpiresInMinutes: number | null;
  /** Role the invitee will be given on redemption (wire integer). */
  inviteAs: number;
  /** Stream IDs the invitee gets auto-subscribed to. */
  streamIds?: readonly number[];
  /** User-group IDs the invitee gets added to. */
  groupIds?: readonly number[];
  /** Whether to notify the referrer when the invitee joins. */
  notifyReferrerOnJoin?: boolean;
}

/**
 * Parameters for `createReusableInviteLink`
 * (`POST /api/v1/invites/multiuse`). Same shape as `SendInvitesParams`
 * minus the per-email field — the server returns a link URL.
 */
export interface CreateReusableInviteLinkParams {
  inviteExpiresInMinutes: number | null;
  inviteAs: number;
  streamIds?: readonly number[];
  groupIds?: readonly number[];
}

/** Response of `POST /api/v1/invites/multiuse`. */
export interface CreateReusableInviteLinkResult {
  invite_link: string;
}

// --- Admin: bots (capability sweep) --------------------------------

/**
 * Parameters for `createBot` (`POST /api/v1/bots`). Mirrors the
 * server's `add_bot_backend` signature; the API client converts
 * `camelCase` keys to the wire `snake_case` names. Fields beyond
 * the first three are bot-type-dependent — incoming-webhook /
 * outgoing-webhook bots need the service-related fields, generic
 * bots ignore them.
 */
export interface CreateBotParams {
  fullName: string;
  /** Local-part of the bot's email; the server appends the realm. */
  shortName: string;
  /** Wire integer: 1=generic, 2=incoming-webhook, 3=outgoing-webhook. */
  botType: number;
  /** Outgoing-webhook endpoint URL. */
  payloadUrl?: string;
  /** Outgoing-webhook interface: 1=Generic, 2=Slack-compatible. */
  interfaceType?: number;
  /** Outgoing-webhook / embedded service name. */
  serviceName?: string;
  /** Embedded / incoming-webhook config dict. */
  config?: Readonly<Record<string, string>>;
  /** Default channel name the bot sends to. */
  defaultSendingStream?: string;
  /** Default channel name the bot registers events for. */
  defaultEventsRegisterStream?: string;
  /** Whether the bot listens on every public channel. */
  defaultAllPublicStreams?: boolean;
}

/** Response of `POST /api/v1/bots`. */
export interface CreateBotResult {
  user_id: number;
  api_key: string;
  avatar_url: string;
  default_sending_stream: string | null;
  default_events_register_stream: string | null;
  default_all_public_streams: boolean;
}

/**
 * Parameters for `updateBot` (`PATCH /api/v1/bots/{bot_user_id}`).
 * Only the keys the caller wants to change are sent; the server
 * leaves the rest untouched.
 */
export interface UpdateBotParams {
  fullName?: string;
  /** New short name; the server constructs a new email from it. */
  shortName?: string;
  /** Reassign ownership of the bot to a different user. */
  botOwnerId?: number;
  /** Outgoing-webhook URL update. */
  servicePayloadUrl?: string;
  /** Outgoing-webhook interface update; 1=Generic, 2=Slack-compatible. */
  serviceInterface?: number;
  defaultSendingStream?: string;
  defaultEventsRegisterStream?: string;
  defaultAllPublicStreams?: boolean;
  config?: Readonly<Record<string, string>>;
  /** Wire integer (100/200/300/400/600). */
  role?: number;
}

/** Response of `POST /api/v1/bots/{bot_user_id}/api_key/regenerate`. */
export interface RegenerateBotApiKeyResult {
  api_key: string;
}


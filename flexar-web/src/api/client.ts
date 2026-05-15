// The typed Zulip REST API client — the single network boundary of the
// app (ENGINEERING_GUIDE §6). No other module issues HTTP requests.
//
// `ApiClient` holds the active credentials (email + API key) as mutable
// state: it is created uncredentialed, the bootstrap `fetchApiKey` call
// works without credentials, and `setCredentials` wires them in once
// they are known. Credentials are never read from `.env` or hardcoded —
// that wiring belongs to a later phase.
//
// Every method returns/accepts the frozen domain types from
// `src/domain`; envelope-only shapes (pagination metadata, the register
// bootstrap payload) come from `./types`. Errors surface as `ApiError`.

import type {
  MessageEdit,
  MessageId,
  ReactionType,
  ScheduledMessage,
  ServerEvent,
  Stream,
  Subscription,
  Topic,
  User,
  UserId,
} from "../domain";
import { narrowToWire } from "./narrow";
import { sendRequest, type Params } from "./request";
import {
  uploadFile,
  type UploadFileOptions,
  type UploadFileResult,
} from "./upload";
import type {
  ApiKeyResult,
  CreateChannelParams,
  CreateReusableInviteLinkParams,
  CreateReusableInviteLinkResult,
  CreateScheduledMessageParams,
  CreateScheduledMessageResult,
  Credentials,
  DeactivateUserParams,
  DeleteMessageResult,
  EditMessageParams,
  EditMessageResult,
  GetChannelSubscribersResult,
  GetDefaultStreamsResult,
  GetEventsResult,
  GetInvitesResult,
  GetMessagesOptions,
  GetMessagesResult,
  GetOwnUserResult,
  GetSingleMessageResult,
  GetStreamsResult,
  GetSubscriptionsResult,
  GetTopicsResult,
  GetUsersResult,
  Invite,
  MarkAsReadResult,
  RegisterQueueOptions,
  RegisterQueueResult,
  RenderMarkdownResult,
  SendInvitesParams,
  SendMessageParams,
  SendMessageResult,
  SendSubmessageParams,
  SendTypingParams,
  SubscribeParams,
  UnsubscribeParams,
  UpdateChannelParams,
  UpdateMessageFlagsParams,
  UpdateMessageFlagsResult,
  UpdateOwnSettingsParams,
  UpdateOwnUserStatusParams,
  UpdateRealmParams,
  UpdateScheduledMessageParams,
  UpdateUserParams,
} from "./types";

/** Options for `getStreams` (`GET /api/v1/streams`). */
export interface GetStreamsOptions {
  includePublic?: boolean;
  includeWebPublic?: boolean;
  includeSubscribed?: boolean;
  excludeArchived?: boolean;
}

/** Options for `getUsers` (`GET /api/v1/users`). */
export interface GetUsersOptions {
  /** Restrict the result to these user IDs. */
  userIds?: number[];
  /** Whether the client computes gravatar URLs itself. */
  clientGravatar?: boolean;
  /** Whether to include custom profile field values. */
  includeCustomProfileFields?: boolean;
}

/** Emoji-identifying triple for reaction add/remove. */
export interface ReactionParams {
  emojiName: string;
  emojiCode?: string;
  reactionType?: ReactionType;
}

export class ApiClient {
  /** Active credentials, or `undefined` until `setCredentials` is called. */
  #credentials: Credentials | undefined;

  constructor(credentials?: Credentials) {
    this.#credentials = credentials;
  }

  /** Install (or replace) the credentials used for authenticated calls. */
  setCredentials(credentials: Credentials): void {
    this.#credentials = credentials;
  }

  /** Drop the active credentials; subsequent authenticated calls throw. */
  clearCredentials(): void {
    this.#credentials = undefined;
  }

  /** Whether the client currently has credentials installed. */
  hasCredentials(): boolean {
    return this.#credentials !== undefined;
  }

  // --- Authentication -----------------------------------------------

  /**
   * Exchange a username + password for an API key.
   * `POST /api/v1/fetch_api_key`. This is the bootstrap call: it runs
   * without credentials and does not mutate client state — the caller
   * decides whether to feed the result into `setCredentials`.
   */
  async fetchApiKey(username: string, password: string): Promise<ApiKeyResult> {
    const body = await sendRequest<{
      api_key: string;
      email: string;
      user_id?: number;
    }>(
      {
        method: "POST",
        path: "/fetch_api_key",
        params: { username, password },
        authenticated: false,
      },
      undefined,
    );
    return {
      apiKey: body.api_key,
      email: body.email,
      userId: body.user_id,
    };
  }

  // --- Realtime transport primitives --------------------------------

  /**
   * Register an event queue. `POST /api/v1/register`.
   *
   * This is only the transport call — it allocates the queue and
   * returns its bootstrap metadata. The subscription loop and event
   * dispatch live in `src/realtime/` (Phase 1.2), not here.
   */
  async registerQueue(
    options: RegisterQueueOptions = {},
  ): Promise<RegisterQueueResult> {
    const params: Params = {
      apply_markdown: options.applyMarkdown,
      client_gravatar: options.clientGravatar,
      slim_presence: options.slimPresence,
      event_types: options.eventTypes,
      fetch_event_types: options.fetchEventTypes,
      include_subscribers: options.includeSubscribers,
      narrow: options.narrow ? narrowToWire(options.narrow) : undefined,
    };
    const body = await sendRequest<{
      queue_id: string | null;
      last_event_id: number;
      zulip_feature_level: number;
      zulip_version: string;
      [key: string]: unknown;
    }>({ method: "POST", path: "/register", params }, this.#credentials);

    const { queue_id, last_event_id, zulip_feature_level, zulip_version } =
      body;
    return {
      ...body,
      queueId: queue_id,
      lastEventId: last_event_id,
      zulipFeatureLevel: zulip_feature_level,
      zulipVersion: zulip_version,
    };
  }

  /**
   * Long-poll an event queue for new events.
   * `GET /api/v1/events`. Returns once events newer than `lastEventId`
   * are available or the server sends a heartbeat. The realtime layer
   * is responsible for the polling loop and acknowledgement bookkeeping.
   *
   * This request blocks server-side by design, so it raises the
   * transport timeout well past the default — the heartbeat (~60s)
   * bounds it in practice; the long `timeoutMs` only guards against a
   * connection the server never answers at all.
   */
  async getEvents(
    queueId: string,
    lastEventId: number,
  ): Promise<GetEventsResult> {
    const body = await sendRequest<{
      events: ServerEvent[];
      queue_id?: string;
    }>(
      {
        method: "GET",
        path: "/events",
        params: { queue_id: queueId, last_event_id: lastEventId },
        timeoutMs: 120_000,
      },
      this.#credentials,
    );
    return { events: body.events, queueId: body.queue_id };
  }

  // --- Messages -----------------------------------------------------

  /**
   * Fetch a range of messages. `GET /api/v1/messages`.
   * `numBefore` / `numAfter` bound the range around `anchor`
   * (default `"newest"`); `narrow` filters which messages match.
   *
   * `applyMarkdown` defaults to `true` — the feed renderer needs the
   * server-rendered HTML, and Zulip's documented default for this
   * parameter is unreliable across versions, so we set it explicitly.
   * Callers wanting raw Markdown (the edit form via `getRawContent`)
   * pass `false` directly.
   */
  async getMessages(options: GetMessagesOptions): Promise<GetMessagesResult> {
    const params: Params = {
      anchor: options.anchor ?? "newest",
      num_before: options.numBefore,
      num_after: options.numAfter,
      include_anchor: options.includeAnchor,
      apply_markdown: options.applyMarkdown ?? true,
      narrow: options.narrow ? narrowToWire(options.narrow) : undefined,
    };
    const body = await sendRequest<{
      messages: GetMessagesResult["messages"];
      anchor: number;
      found_newest: boolean;
      found_oldest: boolean;
      found_anchor: boolean;
      history_limited?: boolean;
    }>({ method: "GET", path: "/messages", params }, this.#credentials);
    return {
      messages: body.messages,
      anchor: body.anchor,
      foundNewest: body.found_newest,
      foundOldest: body.found_oldest,
      foundAnchor: body.found_anchor,
      historyLimited: body.history_limited ?? false,
    };
  }

  /**
   * Send a channel or direct message. `POST /api/v1/messages`.
   * The discriminated `params.type` selects which other fields apply.
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const wire: Params =
      params.type === "channel"
        ? {
            type: "channel",
            to: params.to,
            topic: params.topic,
            content: params.content,
          }
        : {
            type: "direct",
            to: params.to,
            content: params.content,
          };
    const body = await sendRequest<{ id: number }>(
      { method: "POST", path: "/messages", params: wire },
      this.#credentials,
    );
    return { id: body.id };
  }

  /**
   * Render Markdown to sanitised HTML using the server's renderer.
   * `POST /api/v1/messages/render`.
   *
   * The compose box uses this to drive its preview pane: client-side
   * Markdown rendering would duplicate Zulip's server-side renderer, so
   * the preview asks the server for the same HTML the recipient will
   * see. The returned string is rendered through the same
   * `MessageContent` pipeline as fetched message bodies (sanitiser → DOM
   * injection), so it inherits the same XSS boundary.
   */
  async renderMarkdown(content: string): Promise<string> {
    const body = await sendRequest<RenderMarkdownResult>(
      {
        method: "POST",
        path: "/messages/render",
        params: { content },
      },
      this.#credentials,
    );
    return body.rendered;
  }

  /**
   * Edit a message's content, topic, or channel.
   * `PATCH /api/v1/messages/{messageId}`.
   *
   * Phase 3.3 only sets `content` (a content edit); the topic / move
   * parameters (`topic`, `propagateMode`, `sendNotificationToOldThread`,
   * `sendNotificationToNewThread`) are scaffolded so a later
   * move-message feature can use the same method without a signature
   * change.
   */
  async editMessage(
    messageId: MessageId,
    params: EditMessageParams,
  ): Promise<EditMessageResult> {
    const wire: Params = {
      content: params.content,
      topic: params.topic,
      propagate_mode: params.propagateMode,
      send_notification_to_old_thread: params.sendNotificationToOldThread,
      send_notification_to_new_thread: params.sendNotificationToNewThread,
    };
    await sendRequest<unknown>(
      { method: "PATCH", path: `/messages/${messageId}`, params: wire },
      this.#credentials,
    );
    return {};
  }

  /**
   * Permanently delete a message.
   * `DELETE /api/v1/messages/{messageId}`.
   */
  async deleteMessage(messageId: MessageId): Promise<DeleteMessageResult> {
    await sendRequest<unknown>(
      { method: "DELETE", path: `/messages/${messageId}` },
      this.#credentials,
    );
    return {};
  }

  /**
   * Add or remove a personal flag (e.g. `read`, `starred`) on one or
   * more messages. `POST /api/v1/messages/flags`.
   *
   * Returns the IDs of the messages the server actually updated — a
   * subset of the request when the server skipped some (e.g. `remove`
   * `read` on messages in channels the user is not subscribed to).
   */
  async updateMessageFlags(
    params: UpdateMessageFlagsParams,
  ): Promise<UpdateMessageFlagsResult> {
    const body = await sendRequest<{ messages: MessageId[] }>(
      {
        method: "POST",
        path: "/messages/flags",
        params: {
          op: params.op,
          flag: params.flag,
          messages: params.messages,
        },
      },
      this.#credentials,
    );
    return { messages: body.messages };
  }

  /**
   * Mark every unread message in the user's account as read.
   * `POST /api/v1/mark_all_as_read`.
   *
   * On modern servers (feature level 153+) the operation runs as an
   * asynchronous background job and the response carries its id; older
   * servers complete it synchronously. Either way, the realtime
   * `update_message_flags` event with `op:add flag:read all:true`
   * reconciles the local state once the job finishes — callers can
   * apply optimistic updates without waiting for the response.
   */
  async markAllAsRead(): Promise<MarkAsReadResult> {
    const body = await sendRequest<{ partially_completed_id?: number }>(
      { method: "POST", path: "/mark_all_as_read" },
      this.#credentials,
    );
    return { partiallyCompletedId: body.partially_completed_id };
  }

  /**
   * Mark every unread message in one channel as read.
   * `POST /api/v1/mark_stream_as_read`.
   *
   * Asynchronous on modern servers; reconciliation arrives via the
   * realtime event stream. See `markAllAsRead` for the result-shape note.
   */
  async markStreamAsRead(streamId: number): Promise<MarkAsReadResult> {
    const body = await sendRequest<{ partially_completed_id?: number }>(
      {
        method: "POST",
        path: "/mark_stream_as_read",
        params: { stream_id: streamId },
      },
      this.#credentials,
    );
    return { partiallyCompletedId: body.partially_completed_id };
  }

  /**
   * Mark every unread message in one channel-topic as read.
   * `POST /api/v1/mark_topic_as_read`.
   *
   * Asynchronous on modern servers; reconciliation arrives via the
   * realtime event stream. See `markAllAsRead` for the result-shape note.
   */
  async markTopicAsRead(
    streamId: number,
    topicName: string,
  ): Promise<MarkAsReadResult> {
    const body = await sendRequest<{ partially_completed_id?: number }>(
      {
        method: "POST",
        path: "/mark_topic_as_read",
        params: { stream_id: streamId, topic_name: topicName },
      },
      this.#credentials,
    );
    return { partiallyCompletedId: body.partially_completed_id };
  }

  /**
   * Fetch a message's edit history.
   * `GET /api/v1/messages/{messageId}/history`.
   *
   * Returns the chronological list of edit snapshots — each snapshot
   * carries only the fields that changed in that edit (content, topic,
   * channel) plus the editor's user id and the timestamp. The first
   * entry is the original snapshot. Older servers may return fewer
   * fields; `MessageEdit` already models the union.
   */
  async getMessageHistory(messageId: MessageId): Promise<MessageEdit[]> {
    const body = await sendRequest<{ message_history: MessageEdit[] }>(
      { method: "GET", path: `/messages/${messageId}/history` },
      this.#credentials,
    );
    return body.message_history;
  }

  /**
   * Fetch a single message's raw Markdown source.
   * `GET /api/v1/messages/{messageId}?apply_markdown=false`.
   *
   * The cache holds rendered HTML (from `getMessages` with
   * `apply_markdown=true`), but the inline edit form needs the original
   * Markdown so users edit the same source they wrote. The server
   * returns both the modern `message.content` (Markdown when
   * `apply_markdown=false`) and the deprecated top-level `raw_content`;
   * we read `raw_content` because it is unambiguously the raw text on
   * every supported server version.
   */
  async getRawContent(messageId: MessageId): Promise<string> {
    const body = await sendRequest<GetSingleMessageResult>(
      {
        method: "GET",
        path: `/messages/${messageId}`,
        params: { apply_markdown: false },
      },
      this.#credentials,
    );
    return body.raw_content;
  }

  // --- Widgets / submessages ---------------------------------------

  /**
   * Append a submessage to a widget message.
   * `POST /api/v1/submessages`.
   *
   * Used by the poll / todo widgets (Phase 4.7) to record votes,
   * add options, etc. `content` is the widget-specific JSON
   * payload as a string — the server validates it against the
   * parent widget's type before broadcasting it via the
   * `submessage` realtime event.
   */
  async sendSubmessage(params: SendSubmessageParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        // Note: the server endpoint is singular `/submessage`, not
        // plural — `zproject/urls.py` registers `rest_path("submessage", …)`.
        path: "/submessage",
        params: {
          message_id: params.messageId,
          msg_type: params.msgType,
          content: params.content,
        },
      },
      this.#credentials,
    );
  }

  // --- Personal settings --------------------------------------------

  /**
   * Update the authenticated user's personal settings.
   * `PATCH /api/v1/settings`.
   *
   * Only the supplied parameters change — the server's
   * `ignored_parameters_unsupported` envelope tells us about any
   * keys it didn't process, but the UI does not need it for the
   * Phase 5.1 form. The realtime `user_settings update` event
   * echoes each change back so the store reconciles automatically.
   */
  async updateOwnSettings(params: UpdateOwnSettingsParams): Promise<void> {
    const wire: Params = {
      full_name: params.fullName,
      twenty_four_hour_time: params.twenty_four_hour_time,
      enable_sounds: params.enable_sounds,
      enable_desktop_notifications: params.enable_desktop_notifications,
      receives_typing_notifications: params.receives_typing_notifications,
      starred_message_counts: params.starred_message_counts,
    };
    await sendRequest<unknown>(
      { method: "PATCH", path: "/settings", params: wire },
      this.#credentials,
    );
  }

  // --- User status --------------------------------------------------

  /**
   * Update the authenticated user's status text and/or status emoji.
   * `POST /api/v1/users/me/status`.
   *
   * Only the supplied parameters change — passing just `statusText`
   * leaves the emoji untouched. Pass an empty string for `statusText`
   * to clear the text; pass `emojiName: ""` to clear the emoji
   * (Zulip's documented signal). Server emits a `user_status` event
   * to all sessions so the store updates everywhere.
   */
  async updateOwnUserStatus(params: UpdateOwnUserStatusParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        path: "/users/me/status",
        params: {
          status_text: params.statusText,
          emoji_name: params.emojiName,
          emoji_code: params.emojiCode,
          reaction_type: params.reactionType,
        },
      },
      this.#credentials,
    );
  }

  // --- Typing -------------------------------------------------------

  /**
   * Notify the server that the user has started or stopped typing.
   * `POST /api/v1/typing`. Other queue subscribers receive a `typing`
   * event with the same payload.
   *
   * The compose box emits `start` once per typing burst and `stop`
   * after a debounce / on send / on conversation change. The server
   * itself also expires `start` events after ~15s without a `stop`,
   * so a missed `stop` (network glitch) decays gracefully.
   */
  async sendTyping(params: SendTypingParams): Promise<void> {
    const wire: Params =
      params.type === "stream"
        ? {
            op: params.op,
            type: "stream",
            stream_id: params.streamId,
            topic: params.topic,
          }
        : {
            op: params.op,
            type: "direct",
            to: params.to,
          };
    await sendRequest<unknown>(
      { method: "POST", path: "/typing", params: wire },
      this.#credentials,
    );
  }

  // --- Scheduled messages -------------------------------------------

  /**
   * List the user's undelivered scheduled messages, ordered by
   * `scheduled_delivery_timestamp` ascending.
   * `GET /api/v1/scheduled_messages`.
   */
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    const body = await sendRequest<{ scheduled_messages: ScheduledMessage[] }>(
      { method: "GET", path: "/scheduled_messages" },
      this.#credentials,
    );
    return body.scheduled_messages;
  }

  /**
   * Schedule a new message for future delivery.
   * `POST /api/v1/scheduled_messages`.
   *
   * `to`, the recipient list for direct messages, and the delivery
   * timestamp are JSON-encoded server-side; the request transport
   * stringifies arrays for us. The response carries only the new
   * `scheduled_message_id` — the realtime `scheduled_messages add`
   * event delivers the full record.
   */
  async createScheduledMessage(
    params: CreateScheduledMessageParams,
  ): Promise<CreateScheduledMessageResult> {
    const wire: Params =
      params.type === "channel"
        ? {
            type: "channel",
            to: params.to,
            topic: params.topic,
            content: params.content,
            scheduled_delivery_timestamp: params.scheduledDeliveryTimestamp,
          }
        : {
            type: "direct",
            to: params.to,
            content: params.content,
            scheduled_delivery_timestamp: params.scheduledDeliveryTimestamp,
          };
    const body = await sendRequest<{ scheduled_message_id: number }>(
      { method: "POST", path: "/scheduled_messages", params: wire },
      this.#credentials,
    );
    return { scheduledMessageId: body.scheduled_message_id };
  }

  /**
   * Edit an existing scheduled message.
   * `PATCH /api/v1/scheduled_messages/{scheduledMessageId}`.
   *
   * Pass only the fields that change. When the server has already
   * tried and failed to send (`failed: true`) the caller MUST also
   * pass `scheduledDeliveryTimestamp`; the API rejects updates that
   * leave a failed message without a fresh delivery time.
   */
  async updateScheduledMessage(
    scheduledMessageId: number,
    params: UpdateScheduledMessageParams,
  ): Promise<void> {
    const wire: Params = {
      type:
        params.type === "channel"
          ? "channel"
          : params.type === "direct"
            ? "direct"
            : undefined,
      to: params.to,
      topic: params.topic,
      content: params.content,
      scheduled_delivery_timestamp: params.scheduledDeliveryTimestamp,
    };
    await sendRequest<unknown>(
      {
        method: "PATCH",
        path: `/scheduled_messages/${scheduledMessageId}`,
        params: wire,
      },
      this.#credentials,
    );
  }

  /**
   * Cancel a scheduled message.
   * `DELETE /api/v1/scheduled_messages/{scheduledMessageId}`.
   */
  async deleteScheduledMessage(scheduledMessageId: number): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "DELETE",
        path: `/scheduled_messages/${scheduledMessageId}`,
      },
      this.#credentials,
    );
  }

  // --- Reactions ----------------------------------------------------

  /**
   * Add an emoji reaction to a message.
   * `POST /api/v1/messages/{messageId}/reactions`.
   */
  async addReaction(
    messageId: number,
    reaction: ReactionParams,
  ): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        path: `/messages/${messageId}/reactions`,
        params: {
          emoji_name: reaction.emojiName,
          emoji_code: reaction.emojiCode,
          reaction_type: reaction.reactionType,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Remove an emoji reaction from a message.
   * `DELETE /api/v1/messages/{messageId}/reactions`.
   */
  async removeReaction(
    messageId: number,
    reaction: ReactionParams,
  ): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "DELETE",
        path: `/messages/${messageId}/reactions`,
        params: {
          emoji_name: reaction.emojiName,
          emoji_code: reaction.emojiCode,
          reaction_type: reaction.reactionType,
        },
      },
      this.#credentials,
    );
  }

  // --- Subscriptions / streams / users ------------------------------

  /**
   * Fetch the current user's channel subscriptions.
   * `GET /api/v1/users/me/subscriptions`.
   */
  async getSubscriptions(): Promise<Subscription[]> {
    const body = await sendRequest<GetSubscriptionsResult>(
      { method: "GET", path: "/users/me/subscriptions" },
      this.#credentials,
    );
    return body.subscriptions;
  }

  /**
   * Subscribe the current user (or other principals) to one or more
   * channels. `POST /api/v1/users/me/subscriptions`.
   *
   * `subscriptions` is the list of channel names to subscribe to;
   * if a name does not exist the server creates the channel with
   * the supplied description (or none). `principals` lets an admin
   * subscribe other users — Phase 5.5 only uses the
   * subscribe-myself path.
   */
  async subscribe(params: SubscribeParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        path: "/users/me/subscriptions",
        params: {
          subscriptions: params.subscriptions,
          principals: params.principals,
          authorization_errors_fatal: params.authorizationErrorsFatal,
          announce: params.announce,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Unsubscribe the current user (or other principals) from one or
   * more channels by name.
   * `DELETE /api/v1/users/me/subscriptions`.
   */
  async unsubscribe(params: UnsubscribeParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "DELETE",
        path: "/users/me/subscriptions",
        params: {
          subscriptions: params.subscriptions,
          principals: params.principals,
        },
      },
      this.#credentials,
    );
  }

  /** Fetch all channels the user has access to. `GET /api/v1/streams`. */
  async getStreams(options: GetStreamsOptions = {}): Promise<Stream[]> {
    const params: Params = {
      include_public: options.includePublic,
      include_web_public: options.includeWebPublic,
      include_subscribed: options.includeSubscribed,
      exclude_archived: options.excludeArchived,
    };
    const body = await sendRequest<GetStreamsResult>(
      { method: "GET", path: "/streams", params },
      this.#credentials,
    );
    return body.streams;
  }

  /**
   * Fetch the topics in one channel.
   * `GET /api/v1/users/me/{streamId}/topics`. The server returns them
   * ordered by recency (the topic with the most recent message first);
   * that order is preserved in the returned `Topic[]`.
   */
  async getTopics(streamId: number): Promise<Topic[]> {
    const body = await sendRequest<GetTopicsResult>(
      { method: "GET", path: `/users/me/${streamId}/topics` },
      this.#credentials,
    );
    return body.topics;
  }

  /** Fetch users in the organization. `GET /api/v1/users`. */
  async getUsers(options: GetUsersOptions = {}): Promise<User[]> {
    const params: Params = {
      user_ids: options.userIds,
      client_gravatar: options.clientGravatar,
      include_custom_profile_fields: options.includeCustomProfileFields,
    };
    const body = await sendRequest<GetUsersResult>(
      { method: "GET", path: "/users", params },
      this.#credentials,
    );
    return body.members;
  }

  /**
   * Fetch the authenticated account's own profile.
   * `GET /api/v1/users/me`.
   */
  async getOwnUser(): Promise<GetOwnUserResult> {
    return sendRequest<GetOwnUserResult>(
      { method: "GET", path: "/users/me" },
      this.#credentials,
    );
  }

  // --- Admin: realm settings (Phase 5.2) -----------------------------

  /**
   * Update one or more realm-level settings. `PATCH /api/v1/realm`.
   * Pass only what changed — the server merges supplied fields. The
   * realtime `realm` event echoes each change back so the realm-store
   * stays in sync.
   */
  async updateRealm(params: UpdateRealmParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "PATCH",
        path: "/realm",
        params: {
          name: params.name,
          description: params.description,
          allow_message_editing: params.allow_message_editing,
          message_content_edit_limit_seconds:
            params.message_content_edit_limit_seconds,
          message_content_delete_limit_seconds:
            params.message_content_delete_limit_seconds,
          message_retention_days: params.message_retention_days,
          message_edit_history_visibility_policy:
            params.message_edit_history_visibility_policy,
          invite_required: params.invite_required,
          waiting_period_threshold: params.waiting_period_threshold,
        },
      },
      this.#credentials,
    );
  }

  // --- Admin: default streams (Phase 5.2) ----------------------------

  /**
   * Fetch the realm's list of default channels (the channels new users
   * are auto-subscribed to). `GET /api/v1/default_streams`. The same
   * list is also delivered through the `default_streams` realtime
   * event whenever an admin changes it, but this is the bootstrap.
   */
  async getDefaultStreams(): Promise<number[]> {
    const body = await sendRequest<GetDefaultStreamsResult>(
      { method: "GET", path: "/default_streams" },
      this.#credentials,
    );
    return body.default_streams;
  }

  /** Add a channel to the realm's default-streams list. */
  async addDefaultStream(streamId: number): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        path: "/default_streams",
        params: { stream_id: streamId },
      },
      this.#credentials,
    );
  }

  /** Remove a channel from the realm's default-streams list. */
  async removeDefaultStream(streamId: number): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "DELETE",
        path: "/default_streams",
        params: { stream_id: streamId },
      },
      this.#credentials,
    );
  }

  // --- Admin: channels (Phase 5.3) -----------------------------------

  /**
   * Create a new channel by subscribing to a previously-non-existent
   * name. `POST /api/v1/users/me/subscriptions` — the same wire path
   * as `subscribe`, but with the privacy/permission init fields. The
   * realtime `stream:create` + `subscription:add` events echo the new
   * channel back so the streams-store updates without a refetch.
   */
  async createChannel(params: CreateChannelParams): Promise<void> {
    const isPrivate = params.privacy === "private";
    const isWebPublic = params.privacy === "web_public";
    await sendRequest<unknown>(
      {
        method: "POST",
        path: "/users/me/subscriptions",
        params: {
          subscriptions: [
            {
              name: params.name,
              ...(params.description !== undefined && {
                description: params.description,
              }),
            },
          ],
          invite_only: isPrivate,
          is_web_public: isWebPublic,
          history_public_to_subscribers: params.historyPublicToSubscribers,
          principals: params.principals,
          announce: params.announce,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Update a channel's name, description, privacy, history setting, or
   * retention. `PATCH /api/v1/streams/{stream_id}`. Pass only what
   * changed; the server merges. Admin-only for channels the caller
   * doesn't own.
   */
  async updateChannel(
    streamId: number,
    params: UpdateChannelParams,
  ): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "PATCH",
        path: `/streams/${streamId}`,
        params: {
          new_name: params.newName,
          description: params.description,
          is_private: params.isPrivate,
          is_web_public: params.isWebPublic,
          history_public_to_subscribers: params.historyPublicToSubscribers,
          message_retention_days: params.messageRetentionDays,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Archive a channel — Zulip's "delete channel" semantic. The channel
   * remains in the database (with messages preserved per retention
   * policy) but no longer appears in non-archived listings.
   * `DELETE /api/v1/streams/{stream_id}`.
   */
  async archiveChannel(streamId: number): Promise<void> {
    await sendRequest<unknown>(
      { method: "DELETE", path: `/streams/${streamId}` },
      this.#credentials,
    );
  }

  /**
   * Fetch the subscriber user-id list for one channel.
   * `GET /api/v1/streams/{stream_id}/members`. The streams-store
   * already carries `subscribers` for each subscription via register
   * + peer_add/remove events, so this is mostly for admin views of
   * channels the caller is not subscribed to.
   */
  async getChannelSubscribers(streamId: number): Promise<UserId[]> {
    const body = await sendRequest<GetChannelSubscribersResult>(
      { method: "GET", path: `/streams/${streamId}/members` },
      this.#credentials,
    );
    return body.subscribers;
  }

  // --- Admin: users (Phase 5.4) --------------------------------------

  /**
   * Update a user's display name, role, or email.
   * `PATCH /api/v1/users/{user_id}`. Pass only what changed. `role`
   * uses the wire integers (100=owner, 200=admin, 300=moderator,
   * 400=member, 600=guest).
   */
  async updateUser(userId: UserId, params: UpdateUserParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "PATCH",
        path: `/users/${userId}`,
        params: {
          full_name: params.fullName,
          role: params.role,
          new_email: params.newEmail,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Deactivate a user. `DELETE /api/v1/users/{user_id}`. Survives a
   * re-login attempt — only `reactivateUser` brings them back.
   */
  async deactivateUser(
    userId: UserId,
    params: DeactivateUserParams = {},
  ): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "DELETE",
        path: `/users/${userId}`,
        params: {
          deactivation_notification_comment:
            params.deactivationNotificationComment,
          delete_profile: params.deleteProfile,
          delete_user_messages: params.deleteUserMessages,
        },
      },
      this.#credentials,
    );
  }

  /** Reactivate a previously-deactivated user. */
  async reactivateUser(userId: UserId): Promise<void> {
    await sendRequest<unknown>(
      { method: "POST", path: `/users/${userId}/reactivate` },
      this.#credentials,
    );
  }

  // --- Admin: invites (Phase 5.4) ------------------------------------

  /**
   * Fetch every pending or active invitation issued by this realm.
   * `GET /api/v1/invites`. Includes both per-email invites (the
   * common case) and reusable multi-use links.
   */
  async getInvites(): Promise<Invite[]> {
    const body = await sendRequest<GetInvitesResult>(
      { method: "GET", path: "/invites" },
      this.#credentials,
    );
    return body.invites;
  }

  /**
   * Send invitations to one or more email addresses.
   * `POST /api/v1/invites`. The server accepts a comma-or-newline-
   * separated string for `invitee_emails`; we join the supplied array
   * here so call sites stay clean.
   */
  async sendInvites(params: SendInvitesParams): Promise<void> {
    await sendRequest<unknown>(
      {
        method: "POST",
        path: "/invites",
        params: {
          invitee_emails: params.inviteeEmails.join(","),
          invite_expires_in_minutes: params.inviteExpiresInMinutes,
          invite_as: params.inviteAs,
          stream_ids:
            params.streamIds !== undefined ? [...params.streamIds] : undefined,
          group_ids:
            params.groupIds !== undefined ? [...params.groupIds] : undefined,
          notify_referrer_on_join: params.notifyReferrerOnJoin,
        },
      },
      this.#credentials,
    );
  }

  /**
   * Create a multi-use invite link. `POST /api/v1/invites/multiuse`.
   * The returned URL is sharable and valid until expiry.
   */
  async createReusableInviteLink(
    params: CreateReusableInviteLinkParams,
  ): Promise<string> {
    const body = await sendRequest<CreateReusableInviteLinkResult>(
      {
        method: "POST",
        path: "/invites/multiuse",
        params: {
          invite_expires_in_minutes: params.inviteExpiresInMinutes,
          invite_as: params.inviteAs,
          stream_ids:
            params.streamIds !== undefined ? [...params.streamIds] : undefined,
          group_ids:
            params.groupIds !== undefined ? [...params.groupIds] : undefined,
        },
      },
      this.#credentials,
    );
    return body.invite_link;
  }

  /** Revoke a pending or reusable invitation by id. */
  async revokeInvite(inviteId: number): Promise<void> {
    await sendRequest<unknown>(
      { method: "DELETE", path: `/invites/${inviteId}` },
      this.#credentials,
    );
  }

  /** Resend a pending per-email invitation. */
  async resendInvite(inviteId: number): Promise<void> {
    await sendRequest<unknown>(
      { method: "POST", path: `/invites/${inviteId}/resend` },
      this.#credentials,
    );
  }

  // --- Uploads ------------------------------------------------------

  /**
   * Upload one file to `POST /api/v1/user_uploads`. Goes through the
   * dedicated `XMLHttpRequest`-based transport in `./upload` so the
   * caller gets per-byte progress events (the shared `fetch` transport
   * cannot surface upload progress).
   *
   * Pass `signal` to cancel an in-flight upload (the compose box wires
   * an `AbortController` per pending upload so the user can drop one
   * before it completes).
   */
  uploadFile(
    options: Omit<UploadFileOptions, "credentials">,
  ): Promise<UploadFileResult> {
    if (this.#credentials === undefined) {
      // Mirror the `MISSING_CREDENTIALS` thrown by `request.ts`. The
      // import would create a cycle; replicate the shape directly.
      return Promise.reject(
        new Error("Cannot upload a file without credentials."),
      );
    }
    return uploadFile({ ...options, credentials: this.#credentials });
  }
}

/**
 * Create an `ApiClient`. Pass `credentials` only if they are already
 * known at construction time; otherwise create it bare and call
 * `setCredentials` once the bootstrap `fetchApiKey` call returns.
 */
export function createApiClient(credentials?: Credentials): ApiClient {
  return new ApiClient(credentials);
}

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
  ReactionType,
  ServerEvent,
  Stream,
  Subscription,
  Topic,
  User,
} from "../domain";
import { narrowToWire } from "./narrow";
import { sendRequest, type Params } from "./request";
import type {
  ApiKeyResult,
  Credentials,
  GetEventsResult,
  GetMessagesOptions,
  GetMessagesResult,
  GetOwnUserResult,
  GetStreamsResult,
  GetSubscriptionsResult,
  GetTopicsResult,
  GetUsersResult,
  RegisterQueueOptions,
  RegisterQueueResult,
  RenderMarkdownResult,
  SendMessageParams,
  SendMessageResult,
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
   */
  async getMessages(options: GetMessagesOptions): Promise<GetMessagesResult> {
    const params: Params = {
      anchor: options.anchor ?? "newest",
      num_before: options.numBefore,
      num_after: options.numAfter,
      include_anchor: options.includeAnchor,
      apply_markdown: options.applyMarkdown,
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
}

/**
 * Create an `ApiClient`. Pass `credentials` only if they are already
 * known at construction time; otherwise create it bare and call
 * `setCredentials` once the bootstrap `fetchApiKey` call returns.
 */
export function createApiClient(credentials?: Credentials): ApiClient {
  return new ApiClient(credentials);
}

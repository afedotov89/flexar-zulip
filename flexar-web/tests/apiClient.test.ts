// Unit tests for the Zulip REST API client (`src/api`).
//
// `fetch` is mocked so the suite runs fully offline. The focus is the
// transport contract: auth header construction, query/body encoding
// (especially JSON-encoded `narrow`), success-envelope unwrapping, and
// error-envelope -> thrown `ApiError`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Narrow } from "../src/domain";
import { ApiError, createApiClient, isApiError } from "../src/api";

/** A single recorded `fetch` call: the URL and the init it was given. */
interface FetchCall {
  url: string;
  init: RequestInit;
}

let fetchMock: ReturnType<typeof vi.fn>;
const calls: FetchCall[] = [];

/** Responses to hand out, in order, on successive `fetch` calls. */
let responseQueue: Array<() => Promise<Response>>;

/** Queue a JSON response for the next `fetch` call. */
function mockJsonResponse(body: unknown, status = 200): void {
  responseQueue.push(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  calls.length = 0;
  responseQueue = [];
  // The mock always records the call, then serves the next queued
  // response — falling back to an empty success envelope. Recording
  // and response selection are kept separate so a custom response
  // never bypasses the call log.
  fetchMock = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responseQueue.shift();
    if (next !== undefined) {
      return next();
    }
    return Promise.resolve(
      new Response(JSON.stringify({ result: "success", msg: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Pull the headers of the Nth recorded call as a plain object. */
function headersOf(index: number): Record<string, string> {
  return (calls[index].init.headers ?? {}) as Record<string, string>;
}

describe("authentication", () => {
  it("fetchApiKey posts form-encoded credentials without auth header", async () => {
    const client = createApiClient();
    mockJsonResponse({
      result: "success",
      msg: "",
      api_key: "secret-key",
      email: "iago@zulip.com",
      user_id: 5,
    });

    const result = await client.fetchApiKey("iago@zulip.com", "hunter2");

    expect(result).toEqual({
      apiKey: "secret-key",
      email: "iago@zulip.com",
      userId: 5,
    });
    expect(calls[0].url).toBe("/api/v1/fetch_api_key");
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(0)).not.toHaveProperty("Authorization");
    expect(headersOf(0)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("username")).toBe("iago@zulip.com");
    expect(body.get("password")).toBe("hunter2");
  });

  it("attaches HTTP Basic auth on authenticated requests", async () => {
    const client = createApiClient({
      email: "iago@zulip.com",
      apiKey: "secret-key",
    });
    mockJsonResponse({ result: "success", msg: "", subscriptions: [] });

    await client.getSubscriptions();

    const expected = `Basic ${btoa("iago@zulip.com:secret-key")}`;
    expect(headersOf(0).Authorization).toBe(expected);
  });

  it("uses credentials installed later via setCredentials", async () => {
    const client = createApiClient();
    client.setCredentials({ email: "hamlet@zulip.com", apiKey: "key2" });
    mockJsonResponse({ result: "success", msg: "", streams: [] });

    await client.getStreams();

    expect(headersOf(0).Authorization).toBe(
      `Basic ${btoa("hamlet@zulip.com:key2")}`,
    );
  });

  it("throws ApiError when an authenticated call has no credentials", async () => {
    const client = createApiClient();

    await expect(client.getSubscriptions()).rejects.toMatchObject({
      name: "ApiError",
      code: "MISSING_CREDENTIALS",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clearCredentials removes the installed credentials", async () => {
    const client = createApiClient({ email: "a@b.c", apiKey: "k" });
    expect(client.hasCredentials()).toBe(true);
    client.clearCredentials();
    expect(client.hasCredentials()).toBe(false);
    await expect(client.getStreams()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("request encoding", () => {
  const client = () =>
    createApiClient({ email: "iago@zulip.com", apiKey: "secret-key" });

  it("encodes GET params as a query string and omits undefined values", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      messages: [],
      anchor: 42,
      found_newest: true,
      found_oldest: false,
      found_anchor: false,
    });

    await client().getMessages({ numBefore: 10, numAfter: 0 });

    const [path, query] = calls[0].url.split("?");
    expect(path).toBe("/api/v1/messages");
    const params = new URLSearchParams(query);
    expect(params.get("anchor")).toBe("newest");
    expect(params.get("num_before")).toBe("10");
    expect(params.get("num_after")).toBe("0");
    // includeAnchor was not passed -> absent.
    expect(params.has("include_anchor")).toBe(false);
    // applyMarkdown defaults to true so the realtime pipeline and the
    // history fetch agree on rendered HTML — explicit `false` only when
    // the caller wants raw Markdown (`getRawContent`).
    expect(params.get("apply_markdown")).toBe("true");
  });

  it("JSON-encodes the narrow parameter as a single query value", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      messages: [],
      anchor: 1,
      found_newest: true,
      found_oldest: true,
      found_anchor: false,
    });
    const narrow: Narrow = [
      { operator: "channel", operand: "Denmark" },
      { operator: "topic", operand: "weather", negated: true },
    ];

    await client().getMessages({ numBefore: 5, numAfter: 5, narrow });

    const query = new URLSearchParams(calls[0].url.split("?")[1]);
    expect(JSON.parse(query.get("narrow") as string)).toEqual([
      { operator: "channel", operand: "Denmark" },
      { operator: "topic", operand: "weather", negated: true },
    ]);
  });

  it("sends POST params as a form-encoded body, JSON-encoding structured values", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      queue_id: "q-1",
      last_event_id: -1,
      zulip_feature_level: 400,
      zulip_version: "12.0",
    });

    await client().registerQueue({
      eventTypes: ["message", "reaction"],
      applyMarkdown: true,
    });

    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(0)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(JSON.parse(body.get("event_types") as string)).toEqual([
      "message",
      "reaction",
    ]);
    expect(body.get("apply_markdown")).toBe("true");
    // fetch_event_types / narrow were not supplied -> absent.
    expect(body.has("fetch_event_types")).toBe(false);
    expect(body.has("narrow")).toBe(false);
  });

  it("sends a channel message with topic in the form body", async () => {
    mockJsonResponse({ result: "success", msg: "", id: 99 });

    const result = await client().sendMessage({
      type: "channel",
      to: "Denmark",
      topic: "weather",
      content: "hello",
    });

    expect(result).toEqual({ id: 99 });
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("type")).toBe("channel");
    expect(body.get("to")).toBe("Denmark");
    expect(body.get("topic")).toBe("weather");
    expect(body.get("content")).toBe("hello");
  });

  it("sends a direct message with a JSON-encoded recipient list", async () => {
    mockJsonResponse({ result: "success", msg: "", id: 100 });

    await client().sendMessage({
      type: "direct",
      to: [9, 10],
      content: "hi there",
    });

    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("type")).toBe("direct");
    expect(JSON.parse(body.get("to") as string)).toEqual([9, 10]);
    expect(body.has("topic")).toBe(false);
  });

  it("renderMarkdown posts content as a form field and returns rendered HTML", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      rendered: "<p><strong>foo</strong></p>",
    });

    const html = await client().renderMarkdown("**foo**");

    expect(html).toBe("<p><strong>foo</strong></p>");
    expect(calls[0].url).toBe("/api/v1/messages/render");
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(0)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("content")).toBe("**foo**");
  });

  it("editMessage PATCHes the messages endpoint with content in the form body", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().editMessage(42, { content: "**edited**" });

    expect(calls[0].url).toBe("/api/v1/messages/42");
    expect(calls[0].init.method).toBe("PATCH");
    expect(headersOf(0)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("content")).toBe("**edited**");
    // Optional move parameters were not supplied -> absent from the body.
    expect(body.has("topic")).toBe(false);
    expect(body.has("propagate_mode")).toBe(false);
  });

  it("editMessage forwards topic / propagate_mode / notification flags when supplied", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().editMessage(42, {
      topic: "new topic",
      propagateMode: "change_all",
      sendNotificationToOldThread: true,
      sendNotificationToNewThread: false,
    });

    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("topic")).toBe("new topic");
    expect(body.get("propagate_mode")).toBe("change_all");
    expect(body.get("send_notification_to_old_thread")).toBe("true");
    expect(body.get("send_notification_to_new_thread")).toBe("false");
    expect(body.has("content")).toBe(false);
  });

  it("deleteMessage issues a DELETE on the messages endpoint", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().deleteMessage(99);

    expect(calls[0].url).toBe("/api/v1/messages/99");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("updateMessageFlags POSTs op + flag + JSON-encoded message ids", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      messages: [4, 8, 15],
    });

    const result = await client().updateMessageFlags({
      op: "add",
      flag: "starred",
      messages: [4, 8, 15],
    });

    expect(result).toEqual({ messages: [4, 8, 15] });
    expect(calls[0].url).toBe("/api/v1/messages/flags");
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(0)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("op")).toBe("add");
    expect(body.get("flag")).toBe("starred");
    expect(JSON.parse(body.get("messages") as string)).toEqual([4, 8, 15]);
  });

  it("getMessageHistory GETs /messages/{id}/history and returns message_history", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      message_history: [
        { user_id: 1, timestamp: 1000, prev_content: "old" },
        { user_id: 1, timestamp: 2000, prev_topic: "old", topic: "new" },
      ],
    });

    const entries = await client().getMessageHistory(7);

    expect(entries).toHaveLength(2);
    expect(entries[0].prev_content).toBe("old");
    expect(calls[0].url).toBe("/api/v1/messages/7/history");
    expect(calls[0].init.method).toBe("GET");
  });

  it("sendTyping POSTs to /typing with type=stream + stream_id + topic", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().sendTyping({
      op: "start",
      type: "stream",
      streamId: 11,
      topic: "release",
    });

    expect(calls[0].url).toBe("/api/v1/typing");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("op")).toBe("start");
    expect(body.get("type")).toBe("stream");
    expect(body.get("stream_id")).toBe("11");
    expect(body.get("topic")).toBe("release");
  });

  it("sendTyping POSTs to /typing with type=direct + JSON-encoded recipients", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().sendTyping({ op: "stop", type: "direct", to: [5, 7] });

    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("op")).toBe("stop");
    expect(body.get("type")).toBe("direct");
    expect(JSON.parse(body.get("to") as string)).toEqual([5, 7]);
  });

  it("markAllAsRead POSTs to /mark_all_as_read and surfaces the job id", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      partially_completed_id: 42,
    });

    const result = await client().markAllAsRead();

    expect(result).toEqual({ partiallyCompletedId: 42 });
    expect(calls[0].url).toBe("/api/v1/mark_all_as_read");
    expect(calls[0].init.method).toBe("POST");
  });

  it("markStreamAsRead POSTs the stream id as a form param", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    const result = await client().markStreamAsRead(11);

    expect(result).toEqual({ partiallyCompletedId: undefined });
    expect(calls[0].url).toBe("/api/v1/mark_stream_as_read");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("stream_id")).toBe("11");
  });

  it("markTopicAsRead POSTs both the stream id and the topic name", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().markTopicAsRead(11, "release planning");

    expect(calls[0].url).toBe("/api/v1/mark_topic_as_read");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("stream_id")).toBe("11");
    expect(body.get("topic_name")).toBe("release planning");
  });

  it("getRawContent fetches the message with apply_markdown=false and returns raw_content", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      raw_content: "**hi** there",
      message: { id: 7, content: "**hi** there" },
    });

    const raw = await client().getRawContent(7);

    expect(raw).toBe("**hi** there");
    const [path, query] = calls[0].url.split("?");
    expect(path).toBe("/api/v1/messages/7");
    expect(calls[0].init.method).toBe("GET");
    expect(new URLSearchParams(query).get("apply_markdown")).toBe("false");
  });

  it("issues a DELETE with form body for removeReaction", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().removeReaction(7, {
      emojiName: "octopus",
      emojiCode: "1f419",
      reactionType: "unicode_emoji",
    });

    expect(calls[0].url).toBe("/api/v1/messages/7/reactions");
    expect(calls[0].init.method).toBe("DELETE");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("emoji_name")).toBe("octopus");
    expect(body.get("emoji_code")).toBe("1f419");
    expect(body.get("reaction_type")).toBe("unicode_emoji");
  });

  it("passes queue_id and last_event_id to getEvents", async () => {
    mockJsonResponse({ result: "success", msg: "", events: [] });

    const result = await client().getEvents("q-42", 7);

    expect(result).toEqual({ events: [], queueId: undefined });
    const query = new URLSearchParams(calls[0].url.split("?")[1]);
    expect(query.get("queue_id")).toBe("q-42");
    expect(query.get("last_event_id")).toBe("7");
  });

  it("requests a channel's topics by stream id", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      topics: [
        { max_id: 26, name: "deploys" },
        { max_id: 6, name: "general" },
      ],
    });

    const topics = await client().getTopics(42);

    expect(calls[0].url).toBe("/api/v1/users/me/42/topics");
    expect(calls[0].init.method).toBe("GET");
    // The server's recency order is preserved verbatim.
    expect(topics).toEqual([
      { max_id: 26, name: "deploys" },
      { max_id: 6, name: "general" },
    ]);
  });
});

// Phase 5.2/5.3/5.4 admin methods. The wire contract — endpoint path,
// method verb, body parameter names — is what tests pin down; the
// underlying transport (auth header, encoding) is already covered by
// the request-encoding suite above.
describe("admin", () => {
  const client = () =>
    createApiClient({ email: "iago@zulip.com", apiKey: "secret-key" });

  // --- realm ----------------------------------------------------------

  it("updateRealm PATCHes /realm with only the supplied fields", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().updateRealm({
      name: "Flexar Hub Test",
      message_content_edit_limit_seconds: 600,
    });

    expect(calls[0].url).toBe("/api/v1/realm");
    expect(calls[0].init.method).toBe("PATCH");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("name")).toBe("Flexar Hub Test");
    expect(body.get("message_content_edit_limit_seconds")).toBe("600");
    // Fields not supplied are dropped from the wire body.
    expect(body.has("description")).toBe(false);
    expect(body.has("invite_required")).toBe(false);
  });

  // --- default streams ------------------------------------------------

  it("getDefaultStreams returns the default_streams id list", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      default_streams: [11, 22],
    });

    const ids = await client().getDefaultStreams();

    expect(ids).toEqual([11, 22]);
    expect(calls[0].url).toBe("/api/v1/default_streams");
    expect(calls[0].init.method).toBe("GET");
  });

  it("addDefaultStream POSTs the stream id", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().addDefaultStream(11);

    expect(calls[0].url).toBe("/api/v1/default_streams");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("stream_id")).toBe("11");
  });

  it("removeDefaultStream DELETEs with the stream id", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().removeDefaultStream(11);

    expect(calls[0].url).toBe("/api/v1/default_streams");
    expect(calls[0].init.method).toBe("DELETE");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("stream_id")).toBe("11");
  });

  // --- channels -------------------------------------------------------

  it("createChannel POSTs to /users/me/subscriptions with privacy mapped to wire flags", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().createChannel({
      name: "release-engineering",
      description: "Release coordination",
      privacy: "private",
      principals: [5, 6],
    });

    expect(calls[0].url).toBe("/api/v1/users/me/subscriptions");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("subscriptions")).toBe(
      JSON.stringify([
        { name: "release-engineering", description: "Release coordination" },
      ]),
    );
    // Private channel: invite_only=true, web_public=false.
    expect(body.get("invite_only")).toBe("true");
    expect(body.get("is_web_public")).toBe("false");
    expect(body.get("principals")).toBe(JSON.stringify([5, 6]));
  });

  it("updateChannel PATCHes /streams/{id} with snake_cased keys", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().updateChannel(11, {
      newName: "deploys",
      isPrivate: true,
      messageRetentionDays: 30,
    });

    expect(calls[0].url).toBe("/api/v1/streams/11");
    expect(calls[0].init.method).toBe("PATCH");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("new_name")).toBe("deploys");
    expect(body.get("is_private")).toBe("true");
    expect(body.get("message_retention_days")).toBe("30");
  });

  it("updateChannel allows null retention to inherit the realm default", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().updateChannel(11, { messageRetentionDays: null });

    const body = new URLSearchParams(calls[0].init.body as string);
    // null is JSON-encoded so the server reads it as the JSON literal.
    expect(body.get("message_retention_days")).toBe("null");
  });

  it("archiveChannel DELETEs /streams/{id}", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().archiveChannel(11);

    expect(calls[0].url).toBe("/api/v1/streams/11");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("getChannelSubscribers returns the subscriber id list", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      subscribers: [1, 2, 3],
    });

    const ids = await client().getChannelSubscribers(11);

    expect(ids).toEqual([1, 2, 3]);
    expect(calls[0].url).toBe("/api/v1/streams/11/members");
    expect(calls[0].init.method).toBe("GET");
  });

  // --- users ----------------------------------------------------------

  it("updateUser PATCHes /users/{id} with the supplied fields", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().updateUser(7, { fullName: "Alice Liddell", role: 200 });

    expect(calls[0].url).toBe("/api/v1/users/7");
    expect(calls[0].init.method).toBe("PATCH");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("full_name")).toBe("Alice Liddell");
    expect(body.get("role")).toBe("200");
  });

  it("deactivateUser DELETEs /users/{id} with optional reason", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().deactivateUser(7, {
      deactivationNotificationComment: "left the team",
    });

    expect(calls[0].url).toBe("/api/v1/users/7");
    expect(calls[0].init.method).toBe("DELETE");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("deactivation_notification_comment")).toBe("left the team");
  });

  it("reactivateUser POSTs to /users/{id}/reactivate", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().reactivateUser(7);

    expect(calls[0].url).toBe("/api/v1/users/7/reactivate");
    expect(calls[0].init.method).toBe("POST");
  });

  // --- invites --------------------------------------------------------

  it("getInvites returns the invites list", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      invites: [
        {
          id: 1,
          invited: 1_700_000_000,
          email: "alice@example.com",
          is_multiuse: false,
          invited_as: 400,
          expiry_date: 1_700_086_400,
        },
      ],
    });

    const invites = await client().getInvites();

    expect(invites).toHaveLength(1);
    expect(invites[0].email).toBe("alice@example.com");
    expect(calls[0].url).toBe("/api/v1/invites");
    expect(calls[0].init.method).toBe("GET");
  });

  it("sendInvites joins emails with comma and snake-cases params", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().sendInvites({
      inviteeEmails: ["alice@example.com", "bob@example.com"],
      inviteExpiresInMinutes: 1440,
      inviteAs: 400,
      streamIds: [11, 22],
    });

    expect(calls[0].url).toBe("/api/v1/invites");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("invitee_emails")).toBe(
      "alice@example.com,bob@example.com",
    );
    expect(body.get("invite_expires_in_minutes")).toBe("1440");
    expect(body.get("invite_as")).toBe("400");
    expect(body.get("stream_ids")).toBe(JSON.stringify([11, 22]));
  });

  it("sendInvites encodes a never-expires invite as JSON null", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().sendInvites({
      inviteeEmails: ["alice@example.com"],
      inviteExpiresInMinutes: null,
      inviteAs: 400,
    });

    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("invite_expires_in_minutes")).toBe("null");
  });

  it("createReusableInviteLink POSTs to /invites/multiuse and returns the link", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      invite_link: "https://stand.example/join/abc123",
    });

    const link = await client().createReusableInviteLink({
      inviteExpiresInMinutes: 60 * 24 * 7,
      inviteAs: 400,
      streamIds: [11],
    });

    expect(link).toBe("https://stand.example/join/abc123");
    expect(calls[0].url).toBe("/api/v1/invites/multiuse");
    expect(calls[0].init.method).toBe("POST");
    const body = new URLSearchParams(calls[0].init.body as string);
    expect(body.get("invite_as")).toBe("400");
    expect(body.get("stream_ids")).toBe(JSON.stringify([11]));
  });

  it("revokeInvite DELETEs /invites/{id}", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().revokeInvite(42);

    expect(calls[0].url).toBe("/api/v1/invites/42");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("resendInvite POSTs to /invites/{id}/resend", async () => {
    mockJsonResponse({ result: "success", msg: "" });

    await client().resendInvite(42);

    expect(calls[0].url).toBe("/api/v1/invites/42/resend");
    expect(calls[0].init.method).toBe("POST");
  });
});

describe("response handling", () => {
  const client = () =>
    createApiClient({ email: "iago@zulip.com", apiKey: "secret-key" });

  it("unwraps the success envelope into the documented shape", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      messages: [{ id: 1 }],
      anchor: 1,
      found_newest: true,
      found_oldest: false,
      found_anchor: true,
      history_limited: true,
    });

    const result = await client().getMessages({ numBefore: 1, numAfter: 0 });

    expect(result.anchor).toBe(1);
    expect(result.foundNewest).toBe(true);
    expect(result.foundOldest).toBe(false);
    expect(result.foundAnchor).toBe(true);
    expect(result.historyLimited).toBe(true);
    expect(result.messages).toHaveLength(1);
  });

  it("maps register-queue snake_case fields and preserves extra keys", async () => {
    mockJsonResponse({
      result: "success",
      msg: "",
      queue_id: "q-7",
      last_event_id: 12,
      zulip_feature_level: 481,
      zulip_version: "12.0",
      realm_name: "Zulip Dev",
    });

    const result = await client().registerQueue();

    expect(result.queueId).toBe("q-7");
    expect(result.lastEventId).toBe(12);
    expect(result.zulipFeatureLevel).toBe(481);
    expect(result.zulipVersion).toBe("12.0");
    expect(result.realm_name).toBe("Zulip Dev");
  });

  it("throws ApiError carrying code, msg and httpStatus on an error envelope", async () => {
    mockJsonResponse(
      {
        result: "error",
        msg: "Bad event queue ID: q-bad",
        code: "BAD_EVENT_QUEUE_ID",
        queue_id: "q-bad",
      },
      400,
    );

    const error = await client()
      .getEvents("q-bad", 0)
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    const apiError = error as ApiError;
    expect(apiError.code).toBe("BAD_EVENT_QUEUE_ID");
    expect(apiError.message).toBe("Bad event queue ID: q-bad");
    expect(apiError.httpStatus).toBe(400);
    expect(apiError.body?.queue_id).toBe("q-bad");
  });

  it("defaults code to BAD_REQUEST when a legacy error omits it", async () => {
    mockJsonResponse({ result: "error", msg: "Something failed" }, 400);

    const error = (await client()
      .getStreams()
      .catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Something failed");
  });

  it("throws ApiError with HTTP_ERROR on a non-2xx non-JSON response", async () => {
    responseQueue.push(() =>
      Promise.resolve(
        new Response("<html>502 Bad Gateway</html>", { status: 502 }),
      ),
    );

    const error = (await client()
      .getStreams()
      .catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("HTTP_ERROR");
    expect(error.httpStatus).toBe(502);
  });

  it("throws ApiError with NETWORK_ERROR when fetch itself rejects", async () => {
    responseQueue.push(() => Promise.reject(new TypeError("Failed to fetch")));

    const error = (await client()
      .getStreams()
      .catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.httpStatus).toBe(0);
    expect(error.message).toBe("Failed to fetch");
  });
});

describe("request timeout", () => {
  const client = () =>
    createApiClient({ email: "iago@zulip.com", apiKey: "secret-key" });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Queue a `fetch` that never settles on its own and only rejects with
   * an `AbortError` once the request's `AbortController` fires — the
   * behaviour the real `fetch` exhibits when the transport aborts it.
   */
  function mockHangingResponse(): void {
    responseQueue.push(
      () =>
        new Promise<Response>((_resolve, reject) => {
          const signal = calls[calls.length - 1].init.signal;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
  }

  it("throws ApiError with TIMEOUT when a request exceeds the timeout", async () => {
    mockHangingResponse();

    const promise = client()
      .getStreams()
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const error = (await promise) as ApiError;

    expect(error.code).toBe("TIMEOUT");
    expect(error.httpStatus).toBe(0);
  });

  it("clears the timeout on a fast success so it never fires late", async () => {
    mockJsonResponse({ result: "success", msg: "", streams: [] });

    await client().getStreams();
    // Advancing well past the default timeout must not abort or throw:
    // a settled request has already cleared its timer.
    await vi.advanceTimersByTimeAsync(60_000);

    expect(calls[0].init.signal?.aborted).toBe(false);
  });

  it("getEvents opts out of the default timeout with a long bound", async () => {
    mockHangingResponse();

    const promise = client()
      .getEvents("q-1", 0)
      .catch((e: unknown) => e);
    // The default 30s bound has passed; the long-poll is still pending.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls[0].init.signal?.aborted).toBe(false);

    // Its own 120s bound still applies, so it is not unbounded.
    await vi.advanceTimersByTimeAsync(90_000);
    const error = (await promise) as ApiError;
    expect(error.code).toBe("TIMEOUT");
  });
});

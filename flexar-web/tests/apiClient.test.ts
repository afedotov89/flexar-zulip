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
    // includeAnchor / applyMarkdown were not passed -> absent.
    expect(params.has("include_anchor")).toBe(false);
    expect(params.has("apply_markdown")).toBe(false);
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

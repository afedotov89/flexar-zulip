// Low-level transport for the Zulip REST API client.
//
// This module is the single place that touches `fetch`. It owns:
//   - serialising parameters into Zulip's wire formats (query string for
//     GET, `application/x-www-form-urlencoded` body for POST/DELETE),
//   - attaching HTTP Basic auth when credentials are present,
//   - turning the `{ result }` envelope into either a resolved payload
//     or a thrown `ApiError`.
//
// Endpoint methods (see `client.ts`) build a `RequestSpec` and hand it
// here; they never construct URLs, headers, or bodies themselves.

import { ApiError, type ApiErrorBody } from "./errors";

/** Base path every request is relative to; the Vite dev-proxy forwards it. */
const API_BASE = "/api/v1";

/**
 * Default per-request timeout, in milliseconds. A wedged or unreachable
 * server can leave `fetch` pending forever; bounding it means callers
 * always get an `ApiError` to react to instead of a stuck `loading`
 * state. 30s is generous for ordinary REST calls yet short enough that
 * a hung request surfaces promptly. The realtime long-poll
 * (`GET /events`) blocks server-side by design and opts out via
 * `RequestSpec.timeoutMs` — see `client.ts`.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

/** HTTP methods the client issues. */
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * A parameter value before encoding. Objects and arrays are
 * JSON-stringified (Zulip expects JSON-encoded strings for structured
 * params such as `narrow` or `event_types`); scalars are stringified
 * directly. `null` is JSON-encoded as the literal `null` (Zulip
 * accepts it for "no value" on optional fields like
 * `message_retention_days` and `invite_expires_in_minutes`).
 * `undefined` values are dropped entirely.
 */
export type ParamValue =
  | string
  | number
  | boolean
  | null
  | readonly unknown[]
  | Record<string, unknown>
  | undefined;

/** Parameters for one request, keyed by wire parameter name. */
export type Params = Record<string, ParamValue>;

/** Everything an endpoint method needs to describe a single request. */
export interface RequestSpec {
  method: HttpMethod;
  /** Path relative to `/api/v1`, with a leading slash, e.g. `/messages`. */
  path: string;
  /** Request parameters, sent as query string (GET) or form body (else). */
  params?: Params;
  /**
   * Whether the request must carry credentials. Defaults to `true`;
   * only the bootstrap `fetch_api_key` call sets this to `false`.
   */
  authenticated?: boolean;
  /**
   * Per-request timeout in milliseconds; defaults to
   * `DEFAULT_TIMEOUT_MS`. The realtime long-poll (`GET /events`) blocks
   * server-side by design, so it raises this to a much longer bound
   * instead of being killed mid-poll.
   */
  timeoutMs?: number;
  /**
   * Optional external abort signal. If aborted, the in-flight `fetch`
   * is cancelled and an `ApiError` with code `ABORTED` is thrown. Used
   * by the realtime layer's `RealtimeConnection.stop()` to actually
   * cancel its hanging long-poll, instead of letting the request
   * dangle on the server until that side's timeout (which leaks
   * `queue_id` slots and shows up in browser DevTools as orphan
   * pending `/events`).
   */
  signal?: AbortSignal;
}

/** Credentials used to build the HTTP Basic auth header. */
interface AuthCredentials {
  email: string;
  apiKey: string;
}

/**
 * Encode `value` for the wire. Structured values become JSON strings;
 * scalars become their plain string form. Callers must drop `undefined`
 * before reaching here.
 */
function encodeParamValue(value: Exclude<ParamValue, undefined>): string {
  // JSON-encode null and any structured value (arrays, objects);
  // typeof null is "object", so the same branch handles both.
  if (value === null || typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Build URL-encoded params, skipping keys whose value is `undefined`. */
function toSearchParams(params: Params): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.append(key, encodeParamValue(value));
    }
  }
  return search;
}

/**
 * Construct the `Authorization` header value for HTTP Basic auth.
 * Zulip authenticates API requests as `email:api_key`, base64-encoded.
 */
export function basicAuthHeader(credentials: AuthCredentials): string {
  const raw = `${credentials.email}:${credentials.apiKey}`;
  return `Basic ${btoa(raw)}`;
}

/** Decide whether an HTTP status counts as a Zulip error response. */
function isErrorStatus(status: number): boolean {
  return status < 200 || status >= 300;
}

/**
 * Parse a JSON body, returning `undefined` if the body is empty or not
 * valid JSON (e.g. an HTML error page from a misconfigured proxy).
 */
async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Type guard for Zulip's `{ result: "error", ... }` envelope. */
function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { result?: unknown }).result === "error"
  );
}

/**
 * Issue one request and unwrap the result envelope.
 *
 * On success (`2xx` with `result: "success"`) the parsed JSON body is
 * returned as `T` — endpoint methods are responsible for picking the
 * fields they need off it. On any error (non-2xx, error envelope, or a
 * transport failure) an `ApiError` is thrown.
 */
export async function sendRequest<T>(
  spec: RequestSpec,
  credentials: AuthCredentials | undefined,
): Promise<T> {
  const authenticated = spec.authenticated ?? true;
  const headers: Record<string, string> = {};

  if (authenticated) {
    if (credentials === undefined) {
      throw new ApiError(
        "Cannot make an authenticated request without credentials.",
        "MISSING_CREDENTIALS",
        0,
      );
    }
    headers.Authorization = basicAuthHeader(credentials);
  }

  const params = spec.params ?? {};
  let url = `${API_BASE}${spec.path}`;
  const controller = new AbortController();
  // If the caller passed an external signal (e.g. the realtime layer's
  // stop-controller), forward an abort on it to our internal one so
  // the timeout/external paths share a single abort point.
  if (spec.signal !== undefined) {
    if (spec.signal.aborted) {
      controller.abort();
    } else {
      spec.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }
  const init: RequestInit = {
    method: spec.method,
    headers,
    signal: controller.signal,
  };

  if (spec.method === "GET") {
    const query = toSearchParams(params).toString();
    if (query !== "") {
      url = `${url}?${query}`;
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = toSearchParams(params).toString();
  }

  // Bound the request: on timeout, abort the `fetch` and remember that
  // we did, so the resulting `AbortError` is reported as a `TIMEOUT`
  // rather than mistaken for an unrelated cancellation. The timer is
  // cleared in `finally` so it never fires late on a fast response.
  const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (timedOut) {
      throw new ApiError(
        `Request to ${spec.path} timed out after ${timeoutMs}ms.`,
        "TIMEOUT",
        0,
      );
    }
    // External abort (caller cancelled via `spec.signal`) — distinct
    // from a network/transport failure so the realtime loop can drop
    // the result without treating it as a retryable failure.
    if (spec.signal?.aborted === true) {
      throw new ApiError(
        `Request to ${spec.path} was aborted.`,
        "ABORTED",
        0,
      );
    }
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network request failed.",
      "NETWORK_ERROR",
      0,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const body = await parseJsonBody(response);

  if (isErrorStatus(response.status) || isApiErrorBody(body)) {
    if (isApiErrorBody(body)) {
      // Some legacy errors omit `code`; Zulip's own default is BAD_REQUEST.
      const code = typeof body.code === "string" ? body.code : "BAD_REQUEST";
      throw new ApiError(body.msg, code, response.status, body);
    }
    throw new ApiError(
      `Request to ${spec.path} failed with HTTP ${response.status}.`,
      "HTTP_ERROR",
      response.status,
    );
  }

  // Defensive: a 2xx response with an empty / non-JSON body would let
  // callers crash with `Cannot read properties of undefined (reading
  // 'X')` when they read fields off `body`. Seen in the wild during
  // deploy windows when nginx briefly served the SPA index.html for a
  // request that should have been API JSON. Surface as a readable
  // error so the UI's error-state copy ("Не удалось загрузить
  // сообщения" + the error.message) reads like a real diagnostic.
  if (body === undefined) {
    throw new ApiError(
      `Request to ${spec.path} returned an empty or non-JSON body (HTTP ${response.status}). The server may be restarting; try again in a moment.`,
      "EMPTY_RESPONSE",
      response.status,
    );
  }

  return body as T;
}

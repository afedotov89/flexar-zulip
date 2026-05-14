// Error model for the Zulip REST API client.
//
// Zulip signals failures with a non-2xx HTTP status and a JSON body of
// the shape `{ result: "error", msg, code? }`. `ApiError` is the single
// error type the client throws; every rejected client call rejects with
// an instance of it, so callers can branch on `code` / `httpStatus`
// without unwrapping ad-hoc shapes.

/** JSON body Zulip returns on a failed request. */
export interface ApiErrorBody {
  result: "error";
  msg: string;
  /**
   * Machine-readable error identifier. Modern endpoints always send
   * this; a few legacy errors omit it, in which case the client
   * substitutes `"BAD_REQUEST"`.
   */
  code?: string;
  /** Endpoint-specific extra fields (e.g. `queue_id` on a bad queue). */
  [key: string]: unknown;
}

/**
 * Thrown by every API client method when the server reports an error,
 * or when the transport itself fails (network error, non-JSON body).
 */
export class ApiError extends Error {
  /** Zulip's machine-readable error code, e.g. `BAD_EVENT_QUEUE_ID`. */
  readonly code: string;
  /** HTTP status of the response; `0` for transport-level failures. */
  readonly httpStatus: number;
  /** The full parsed error body, when the server returned one. */
  readonly body: ApiErrorBody | undefined;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    body?: ApiErrorBody,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.body = body;
  }
}

/** Narrowing helper for `catch` blocks. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

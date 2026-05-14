// Public surface of the API client layer.
//
// This is the single network boundary of the app (ENGINEERING_GUIDE
// §6). Import the client and its types from `src/api` (this file) —
// never reach into individual modules, and never issue `fetch` calls
// elsewhere. Domain entities are not re-exported here; import those
// from `src/domain`.

export { ApiClient, createApiClient } from "./client";
export type {
  GetStreamsOptions,
  GetUsersOptions,
  ReactionParams,
} from "./client";

export { apiClient } from "./apiClient";

export { ApiError, isApiError } from "./errors";
export type { ApiErrorBody } from "./errors";

export type {
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
  MessageAnchor,
  RegisterQueueOptions,
  RegisterQueueResult,
  SendMessageParams,
  SendMessageResult,
} from "./types";

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
  CreateScheduledMessageParams,
  CreateScheduledMessageResult,
  Credentials,
  DeleteMessageResult,
  EditMessageParams,
  EditMessagePropagateMode,
  EditMessageResult,
  GetEventsResult,
  GetMessagesOptions,
  GetMessagesResult,
  GetOwnUserResult,
  GetSingleMessageResult,
  GetStreamsResult,
  GetMessageHistoryResult,
  GetSubscriptionsResult,
  GetTopicsResult,
  GetUsersResult,
  MarkAsReadResult,
  MessageAnchor,
  RegisterQueueOptions,
  RegisterQueueResult,
  RenderMarkdownResult,
  SendMessageParams,
  SendMessageResult,
  SendTypingParams,
  UpdateMessageFlagsParams,
  UpdateMessageFlagsResult,
  UpdateScheduledMessageParams,
} from "./types";

export {
  isImageType,
  sanitiseLinkText,
  uploadToMarkdown,
} from "./upload";
export type { UploadFileOptions, UploadFileResult } from "./upload";

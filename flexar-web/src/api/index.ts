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
  ChannelPrivacy,
  CreateChannelParams,
  CreateReusableInviteLinkParams,
  CreateReusableInviteLinkResult,
  CreateScheduledMessageParams,
  CreateScheduledMessageResult,
  Credentials,
  DeactivateUserParams,
  DeleteMessageResult,
  EditMessageParams,
  EditMessagePropagateMode,
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
  GetMessageHistoryResult,
  GetSubscriptionsResult,
  GetTopicsResult,
  GetUsersResult,
  Invite,
  MarkAsReadResult,
  MessageAnchor,
  RegisterQueueOptions,
  RegisterQueueResult,
  RenderMarkdownResult,
  SendInvitesParams,
  SendMessageParams,
  SendMessageResult,
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

export {
  isImageType,
  sanitiseLinkText,
  uploadToMarkdown,
} from "./upload";
export type { UploadFileOptions, UploadFileResult } from "./upload";

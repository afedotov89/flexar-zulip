// Public surface of the domain type layer.
//
// Every type describing the shapes the Zulip backend speaks is
// re-exported here. Import domain types from `@/domain` (or
// `src/domain`) rather than reaching into individual files, so the
// internal file layout can change without touching consumers.

export type {
  BotType,
  GroupSettingValue,
  MessageId,
  Role,
  StreamId,
  UnixTimestamp,
  UserId,
} from "./primitives";
export { BotType as BotTypeValues, Role as RoleValues } from "./primitives";

export type {
  Draft,
  EmojiIdentity,
  Reaction,
  ReactionType,
  RealmEmoji,
} from "./emoji";

export type {
  Presence,
  PresenceMap,
  ProfileData,
  ProfileFieldValue,
  User,
  UserStatus,
} from "./user";

export type {
  ChannelBase,
  ChannelPermissionGroups,
  Stream,
  Subscription,
  Topic,
} from "./stream";
export { TopicVisibilityPolicy } from "./stream";

export type {
  DirectMessageRecipient,
  DisplayRecipient,
  Message,
  MessageEdit,
  MessageFlag,
  MessageType,
  Submessage,
  TopicLink,
} from "./message";

export type {
  Narrow,
  NarrowOperator,
  NarrowTerm,
  NarrowTuple,
} from "./narrow";

export type { ChannelFolder, OwnUser, Realm } from "./realm";

export type { ScheduledMessage, ScheduledMessageType } from "./scheduledMessage";

export type {
  DefaultStreamsEvent,
  DeleteMessageEvent,
  HeartbeatEvent,
  MessageEvent,
  PresenceEvent,
  ReactionEvent,
  RealmEmojiUpdateEvent,
  RealmEvent,
  RealmUpdateDictEvent,
  RealmUpdateEvent,
  RealmUserAddEvent,
  RealmUserEvent,
  RealmUserRemoveEvent,
  RealmUserUpdateEvent,
  ScheduledMessagesAddEvent,
  ScheduledMessagesEvent,
  ScheduledMessagesRemoveEvent,
  ScheduledMessagesUpdateEvent,
  ServerEvent,
  SubmessageEvent,
  UserSettingsUpdateEvent,
  StreamCreateEvent,
  StreamDeleteEvent,
  StreamEvent,
  StreamUpdateEvent,
  SubscriptionAddEvent,
  SubscriptionEvent,
  SubscriptionPeerAddEvent,
  SubscriptionPeerRemoveEvent,
  SubscriptionRemoveEvent,
  SubscriptionUpdateEvent,
  TypingEvent,
  TypingEventUser,
  UnknownEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
  UserStatusEvent,
  UserTopicEvent,
} from "./events";

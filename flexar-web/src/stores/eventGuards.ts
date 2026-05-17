// Type guards that narrow a `ServerEvent` to a precisely-modelled
// member.
//
// The domain `ServerEvent` union closes with `UnknownEvent`, whose
// `type` is a broad `string`. That makes a bare `event.type === "..."`
// check insufficient to narrow: TypeScript cannot rule out an
// `UnknownEvent` that happens to carry that `type` string. These
// guards do the discrimination once, with an `is` predicate, so the
// store wiring can hand the reducers the precise event type they
// expect. The check is sound: a real event of a given `type` always
// has that member's shape — the server guarantees it.

import type {
  DefaultStreamsEvent,
  DeleteMessageEvent,
  MessageEvent,
  PresenceEvent,
  ReactionEvent,
  RealmEmojiUpdateEvent,
  RealmEvent,
  RealmUserEvent,
  ScheduledMessagesEvent,
  ServerEvent,
  StreamEvent,
  SubmessageEvent,
  SubscriptionEvent,
  TypingEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
  UserSettingsUpdateEvent,
  UserStatusEvent,
} from "../domain";

export function isMessageEvent(event: ServerEvent): event is MessageEvent {
  return event.type === "message";
}

export function isUpdateMessageEvent(
  event: ServerEvent,
): event is UpdateMessageEvent {
  return event.type === "update_message";
}

export function isDeleteMessageEvent(
  event: ServerEvent,
): event is DeleteMessageEvent {
  return event.type === "delete_message";
}

export function isReactionEvent(event: ServerEvent): event is ReactionEvent {
  return event.type === "reaction";
}

export function isUpdateMessageFlagsEvent(
  event: ServerEvent,
): event is UpdateMessageFlagsEvent {
  return event.type === "update_message_flags";
}

export function isRealmUserEvent(
  event: ServerEvent,
): event is RealmUserEvent {
  return event.type === "realm_user";
}

export function isStreamEvent(event: ServerEvent): event is StreamEvent {
  return event.type === "stream";
}

export function isSubscriptionEvent(
  event: ServerEvent,
): event is SubscriptionEvent {
  return event.type === "subscription";
}

export function isPresenceEvent(event: ServerEvent): event is PresenceEvent {
  return event.type === "presence";
}

export function isTypingEvent(event: ServerEvent): event is TypingEvent {
  return event.type === "typing";
}

export function isScheduledMessagesEvent(
  event: ServerEvent,
): event is ScheduledMessagesEvent {
  return event.type === "scheduled_messages";
}

export function isUserStatusEvent(
  event: ServerEvent,
): event is UserStatusEvent {
  return event.type === "user_status";
}

export function isSubmessageEvent(
  event: ServerEvent,
): event is SubmessageEvent {
  return event.type === "submessage";
}

export function isUserSettingsUpdateEvent(
  event: ServerEvent,
): event is UserSettingsUpdateEvent {
  return event.type === "user_settings";
}

export function isRealmEvent(event: ServerEvent): event is RealmEvent {
  return (
    event.type === "realm" &&
    (event.op === "update" || event.op === "update_dict")
  );
}

export function isDefaultStreamsEvent(
  event: ServerEvent,
): event is DefaultStreamsEvent {
  return event.type === "default_streams";
}

export function isRealmEmojiUpdateEvent(
  event: ServerEvent,
): event is RealmEmojiUpdateEvent {
  return event.type === "realm_emoji" && event.op === "update";
}

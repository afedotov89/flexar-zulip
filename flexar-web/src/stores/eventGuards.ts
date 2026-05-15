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
  DeleteMessageEvent,
  MessageEvent,
  PresenceEvent,
  ReactionEvent,
  RealmUserEvent,
  ScheduledMessagesEvent,
  ServerEvent,
  StreamEvent,
  SubscriptionEvent,
  TypingEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
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

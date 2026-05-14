// Test fixtures for the server-state store suites.
//
// The domain types (`User`, `Stream`, `Subscription`, `Message`) have
// many required fields the reducers do not touch. These builders
// produce a complete, valid object from a small set of overrides, so
// each test states only the fields it actually exercises. Not shipped
// — imported solely by `*.test.ts` files in `src/stores/`.

import type {
  Message,
  Reaction,
  Stream,
  Subscription,
  User,
} from "../domain";
import type { InitialState } from "../realtime";

/** A valid `User`, overridable per field. */
export function makeUser(overrides: Partial<User> & { user_id: number }): User {
  return {
    delivery_email: null,
    email: `user${overrides.user_id}@example.com`,
    full_name: `User ${overrides.user_id}`,
    date_joined: "2024-01-01T00:00:00Z",
    is_active: true,
    is_owner: false,
    is_admin: false,
    is_guest: false,
    is_bot: false,
    bot_type: null,
    bot_owner_id: null,
    role: 400,
    timezone: "",
    avatar_url: null,
    avatar_version: 1,
    is_imported_stub: false,
    ...overrides,
  };
}

/** A valid `Stream`, overridable per field. */
export function makeStream(
  overrides: Partial<Stream> & { stream_id: number },
): Stream {
  return {
    name: `channel-${overrides.stream_id}`,
    description: "",
    rendered_description: "",
    is_archived: false,
    invite_only: false,
    is_web_public: false,
    history_public_to_subscribers: true,
    creator_id: null,
    message_retention_days: null,
    first_message_id: null,
    folder_id: null,
    stream_weekly_traffic: null,
    subscriber_count: 0,
    date_created: 1_700_000_000,
    is_recently_active: true,
    ...overrides,
  };
}

/** A valid `Subscription`, overridable per field. */
export function makeSubscription(
  overrides: Partial<Subscription> & { stream_id: number },
): Subscription {
  return {
    name: `channel-${overrides.stream_id}`,
    description: "",
    rendered_description: "",
    is_archived: false,
    invite_only: false,
    is_web_public: false,
    history_public_to_subscribers: true,
    creator_id: null,
    message_retention_days: null,
    first_message_id: null,
    folder_id: null,
    stream_weekly_traffic: null,
    subscriber_count: 0,
    color: "#000000",
    pin_to_top: false,
    is_muted: false,
    desktop_notifications: null,
    email_notifications: null,
    push_notifications: null,
    audible_notifications: null,
    wildcard_mentions_notify: null,
    ...overrides,
  };
}

/** A valid `Message`, overridable per field. */
export function makeMessage(
  overrides: Partial<Message> & { id: number },
): Message {
  return {
    type: "stream",
    content: "<p>hello</p>",
    content_type: "text/html",
    subject: "topic",
    topic_links: [],
    stream_id: 1,
    display_recipient: "channel-1",
    recipient_id: 1,
    sender_id: 1,
    sender_email: "user1@example.com",
    sender_full_name: "User 1",
    sender_realm_str: "flexar",
    avatar_url: null,
    timestamp: 1_700_000_000,
    client: "test",
    is_me_message: false,
    reactions: [],
    submessages: [],
    ...overrides,
  };
}

/** A reaction triple plus reactor id. */
export function makeReaction(overrides: Partial<Reaction>): Reaction {
  return {
    user_id: 1,
    emoji_name: "thumbs_up",
    emoji_code: "1f44d",
    reaction_type: "unicode_emoji",
    ...overrides,
  };
}

/** A register snapshot with the given extra initial-state keys. */
export function makeInitialState(
  extra: Record<string, unknown> = {},
): InitialState {
  return {
    queueId: "q1",
    lastEventId: 0,
    zulipFeatureLevel: 0,
    zulipVersion: "test",
    ...extra,
  };
}

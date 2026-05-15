// Integration-level wiring tests for the Phase 1.3 server-state stores.
//
// Each store calls `wireStore(...)` at module load with the shared
// `realtimeConnection`. This suite mocks the `../realtime` module so
// that singleton is a fake whose `onInitialState` / `subscribe`
// listeners the test can capture and fire — then imports every store
// module and asserts the full path: subscribed at load, hydrated from
// the snapshot, re-hydrated on a second snapshot (re-register), and the
// event stream folded on top.
//
// The reducers themselves are covered exhaustively by the
// `*Reducer.test.ts` suites; here we verify the wiring delivers
// snapshots and events to them and into store state. Fully offline —
// no real realtime layer, no `fetch`.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerEvent } from "../domain";
import type { InitialState } from "../realtime";
import { makeMessage, makeStream, makeUser } from "./testFixtures";
import { emptyUnreadBuckets } from "./unreadReducer";

// Capture the listeners the stores register at module load.
const { initialStateListeners, eventListeners } = vi.hoisted(() => ({
  initialStateListeners: new Set<(state: InitialState) => void>(),
  eventListeners: new Set<(event: ServerEvent) => void>(),
}));

// Mock the realtime layer: `realtimeConnection` becomes a fake whose
// `onInitialState` / `subscribe` just collect listeners. `wireStore`
// (not mocked) wires the real stores to this fake.
vi.mock("../realtime", () => ({
  realtimeConnection: {
    onInitialState(listener: (state: InitialState) => void) {
      initialStateListeners.add(listener);
      return () => initialStateListeners.delete(listener);
    },
    subscribe(listener: (event: ServerEvent) => void) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
  },
}));

/** Fire a register snapshot at every store's `hydrate`. */
function emitInitialState(extra: Record<string, unknown> = {}): void {
  const state: InitialState = {
    queueId: "q1",
    lastEventId: 0,
    zulipFeatureLevel: 0,
    zulipVersion: "test",
    ...extra,
  };
  for (const listener of initialStateListeners) {
    listener(state);
  }
}

/** Fire one event at every store's `applyEvent`. */
function emitEvent(event: ServerEvent): void {
  for (const listener of eventListeners) {
    listener(event);
  }
}

// Import the stores after the mock is registered, so their module-load
// `wireStore` call binds to the fake connection.
const { useRealmStore } = await import("./realmStore");
const { useUsersStore } = await import("./usersStore");
const { useStreamsStore } = await import("./streamsStore");
const { useMessagesStore } = await import("./messagesStore");
const { usePresenceStore } = await import("./presenceStore");
const { useUnreadStore } = await import("./unreadStore");
const { useDmConversationsStore } = await import("./dmConversationsStore");
const { useTopicsStore } = await import("./topicsStore");
const { useRealmEmojiStore } = await import("./realmEmojiStore");
const { useTypingStore } = await import("./typingStore");
const { useScheduledMessagesStore } = await import("./scheduledMessagesStore");
const { useUserStatusesStore } = await import("./userStatusesStore");
const { useUserSettingsStore } = await import("./userSettingsStore");
const { useAuthStore } = await import("./authStore");

// The number of server-state stores that wire themselves at module load.
const STORE_COUNT = 13;

describe("server-state stores — wiring", () => {
  beforeEach(() => {
    // Each store subscribed exactly once, at module load.
    expect(initialStateListeners.size).toBe(STORE_COUNT);
    expect(eventListeners.size).toBe(STORE_COUNT);
    // Reset every store to its empty baseline between tests.
    useRealmStore.setState({ realm: null });
    useUsersStore.setState({ users: {} });
    useStreamsStore.setState({ streams: {}, subscriptions: {} });
    useMessagesStore.setState({ messages: {}, flags: {} });
    usePresenceStore.setState({ presences: {} });
    useUnreadStore.setState({ unread: emptyUnreadBuckets() });
    useDmConversationsStore.setState({ conversations: [] });
    useTopicsStore.setState({ topicsByChannel: {}, loadStatus: {} });
    useRealmEmojiStore.setState({ emojiById: {} });
    useTypingStore.setState({ buckets: {} });
    useScheduledMessagesStore.setState({
      scheduledMessages: {},
      loadStatus: "idle",
    });
    useUserStatusesStore.setState({ statuses: {} });
    useUserSettingsStore.setState({ settings: {} });
  });

  it("every store subscribes at module load", () => {
    // Asserted in beforeEach; this names the contract explicitly.
    expect(initialStateListeners.size).toBe(STORE_COUNT);
    expect(eventListeners.size).toBe(STORE_COUNT);
  });

  it("all stores hydrate from a register snapshot", () => {
    emitInitialState({
      realm_name: "Flexar",
      realm_users: [makeUser({ user_id: 1 })],
      streams: [makeStream({ stream_id: 10 })],
      presences: { 1: { active_timestamp: 1000 } },
      unread_msgs: {
        count: 1,
        streams: [{ stream_id: 10, topic: "t", unread_message_ids: [500] }],
      },
    });

    expect(useRealmStore.getState().realm).toEqual({ realm_name: "Flexar" });
    expect(useUsersStore.getState().getUser(1)?.user_id).toBe(1);
    expect(useStreamsStore.getState().getStream(10)?.stream_id).toBe(10);
    expect(usePresenceStore.getState().getPresence(1)).toEqual({
      active_timestamp: 1000,
    });
    expect(useUnreadStore.getState().isUnread(500)).toBe(true);
  });

  it("hydrates the realm-emoji store from the realm_emoji map", () => {
    emitInitialState({
      realm_emoji: {
        "1": {
          id: "1",
          name: "rocket",
          source_url: "/static/realm/1.png",
          still_url: null,
          deactivated: false,
          author_id: null,
        },
      },
    });
    expect(useRealmEmojiStore.getState().getByName("rocket")?.id).toBe("1");
  });

  it("re-hydrates every store on a second snapshot (re-register)", () => {
    emitInitialState({ realm_users: [makeUser({ user_id: 1 })] });
    expect(useUsersStore.getState().getUser(1)).toBeDefined();

    // A re-register snapshot with different state fully replaces it.
    emitInitialState({ realm_users: [makeUser({ user_id: 2 })] });
    expect(useUsersStore.getState().getUser(1)).toBeUndefined();
    expect(useUsersStore.getState().getUser(2)).toBeDefined();
  });

  it("the messages store clears on re-register", () => {
    emitEvent({
      id: 1,
      type: "message",
      message: makeMessage({ id: 42 }),
      flags: [],
    });
    expect(useMessagesStore.getState().getMessage(42)).toBeDefined();

    // A re-register snapshot carries no message bodies — cache clears.
    emitInitialState();
    expect(useMessagesStore.getState().getMessage(42)).toBeUndefined();
  });

  it("folds realm_user events into the users store", () => {
    emitInitialState({ realm_users: [makeUser({ user_id: 1 })] });
    emitEvent({
      id: 2,
      type: "realm_user",
      op: "add",
      person: makeUser({ user_id: 3, full_name: "Added" }),
    });
    expect(useUsersStore.getState().getUser(3)?.full_name).toBe("Added");
  });

  it("folds message events into the messages store", () => {
    emitEvent({
      id: 3,
      type: "message",
      message: makeMessage({ id: 99 }),
      flags: ["mentioned"],
    });
    expect(useMessagesStore.getState().getMessage(99)?.id).toBe(99);
    expect(useMessagesStore.getState().getFlags(99)).toEqual(["mentioned"]);
  });

  it("folds presence events into the presence store", () => {
    emitEvent({
      id: 4,
      type: "presence",
      presences: { 5: { active_timestamp: 7000 } },
    });
    expect(usePresenceStore.getState().getPresence(5)).toEqual({
      active_timestamp: 7000,
    });
  });

  it("a message from another user lands as unread", () => {
    // `unreadStore` reads the viewer id from `authStore`.
    useAuthStore.setState({
      session: { email: "me@example.com", apiKey: "k", userId: 1 },
    });
    emitEvent({
      id: 5,
      type: "message",
      message: makeMessage({ id: 700, sender_id: 2 }),
      flags: [],
    });
    expect(useUnreadStore.getState().isUnread(700)).toBe(true);

    // The viewer's own message does not.
    emitEvent({
      id: 6,
      type: "message",
      message: makeMessage({ id: 701, sender_id: 1 }),
      flags: [],
    });
    expect(useUnreadStore.getState().isUnread(701)).toBe(false);
  });

  it("update_message_flags read removes a message from unread", () => {
    // A message from another user is tracked as unread...
    useAuthStore.setState({
      session: { email: "me@example.com", apiKey: "k", userId: 1 },
    });
    emitEvent({
      id: 7,
      type: "message",
      message: makeMessage({ id: 800, sender_id: 2 }),
      flags: [],
    });
    expect(useUnreadStore.getState().isUnread(800)).toBe(true);

    // ...and the read flag clears it.
    emitEvent({
      id: 8,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [800],
      all: false,
    });
    expect(useUnreadStore.getState().isUnread(800)).toBe(false);
  });

  it("hydrates the DM conversations store from recent_private_conversations", () => {
    useAuthStore.setState({
      session: { email: "me@example.com", apiKey: "k", userId: 1 },
    });
    emitInitialState({
      recent_private_conversations: [
        { max_message_id: 80, user_ids: [2] },
      ],
    });
    expect(
      useDmConversationsStore.getState().conversations.map(
        (c) => c.conversationKey,
      ),
    ).toEqual(["1,2"]);
  });

  it("folds a DM message into the DM conversations store", () => {
    emitEvent({
      id: 9,
      type: "message",
      message: makeMessage({
        id: 900,
        type: "private",
        subject: "",
        display_recipient: [
          { id: 1, email: "me@b.c", full_name: "Me", is_mirror_dummy: false },
          { id: 2, email: "a@b.c", full_name: "Ada", is_mirror_dummy: false },
        ],
      }),
      flags: [],
    });
    expect(
      useDmConversationsStore.getState().conversations[0]?.conversationKey,
    ).toBe("1,2");
  });

  it("folds a channel message into a loaded channel's topics store", () => {
    // A channel only gets folded into once it has been loaded; seed a
    // loaded channel directly (the lazy `loadTopics` fetch is covered
    // by the topics store's own suite).
    useTopicsStore.setState({
      topicsByChannel: { 10: [{ name: "old", max_id: 1 }] },
      loadStatus: { 10: "loaded" },
    });
    emitEvent({
      id: 10,
      type: "message",
      message: makeMessage({
        id: 1000,
        type: "stream",
        stream_id: 10,
        subject: "fresh",
      }),
      flags: [],
    });
    expect(
      useTopicsStore.getState().getTopics(10).map((t) => t.name),
    ).toEqual(["fresh", "old"]);
  });

  it("clears the topics store on re-register", () => {
    useTopicsStore.setState({
      topicsByChannel: { 10: [{ name: "t", max_id: 1 }] },
      loadStatus: { 10: "loaded" },
    });
    emitInitialState();
    expect(useTopicsStore.getState().topicsByChannel).toEqual({});
    expect(useTopicsStore.getState().loadStatus).toEqual({});
  });

  it("folds scheduled-messages add/update/remove events into the store", () => {
    emitEvent({
      id: 11,
      type: "scheduled_messages",
      op: "add",
      scheduled_messages: [
        {
          scheduled_message_id: 7,
          type: "stream",
          to: 10,
          topic: "release",
          content: "Reminder",
          rendered_content: "<p>Reminder</p>",
          scheduled_delivery_timestamp: 1000,
          failed: false,
        },
      ],
    });
    expect(useScheduledMessagesStore.getState().get(7)?.content).toBe(
      "Reminder",
    );

    emitEvent({
      id: 12,
      type: "scheduled_messages",
      op: "update",
      scheduled_message: {
        scheduled_message_id: 7,
        type: "stream",
        to: 10,
        topic: "release",
        content: "Edited",
        rendered_content: "<p>Edited</p>",
        scheduled_delivery_timestamp: 2000,
        failed: false,
      },
    });
    expect(useScheduledMessagesStore.getState().get(7)?.content).toBe("Edited");

    emitEvent({
      id: 13,
      type: "scheduled_messages",
      op: "remove",
      scheduled_message_id: 7,
    });
    expect(useScheduledMessagesStore.getState().get(7)).toBeUndefined();
  });

  it("hydrates user statuses from the user_status snapshot", () => {
    emitInitialState({
      user_status: {
        "5": { status_text: "ooo" },
        "6": { emoji_name: "rocket", emoji_code: "1f680", reaction_type: "unicode_emoji" },
      },
    });
    expect(useUserStatusesStore.getState().getStatus(5)?.status_text).toBe("ooo");
    expect(useUserStatusesStore.getState().getStatus(6)?.emoji_name).toBe("rocket");
  });

  it("folds user_status events and clears empty statuses", () => {
    useUserStatusesStore.setState({
      statuses: { 5: { status_text: "ooo" } },
    });
    emitEvent({
      id: 14,
      type: "user_status",
      user_id: 5,
      status_text: "back",
      emoji_name: "wave",
      emoji_code: "1f44b",
      reaction_type: "unicode_emoji",
    });
    expect(useUserStatusesStore.getState().getStatus(5)?.status_text).toBe(
      "back",
    );
    expect(useUserStatusesStore.getState().getStatus(5)?.emoji_name).toBe(
      "wave",
    );

    emitEvent({
      id: 15,
      type: "user_status",
      user_id: 5,
      status_text: "",
      emoji_name: "",
      emoji_code: "",
      reaction_type: "",
    });
    expect(useUserStatusesStore.getState().getStatus(5)).toBeUndefined();
  });

  it("hydrates user_settings from the snapshot and folds update events", () => {
    emitInitialState({
      user_settings: {
        twenty_four_hour_time: true,
        enable_sounds: false,
        web_font_size_px: 14,
      },
    });
    expect(useUserSettingsStore.getState().getBoolean("twenty_four_hour_time")).toBe(
      true,
    );
    expect(useUserSettingsStore.getState().getBoolean("enable_sounds")).toBe(false);
    expect(useUserSettingsStore.getState().getNumber("web_font_size_px")).toBe(14);

    emitEvent({
      id: 21,
      type: "user_settings",
      op: "update",
      property: "enable_sounds",
      value: true,
    });
    expect(useUserSettingsStore.getState().getBoolean("enable_sounds")).toBe(true);
  });

  it("clears the scheduled-messages store on re-register", () => {
    useScheduledMessagesStore.setState({
      scheduledMessages: {
        7: {
          scheduled_message_id: 7,
          type: "private",
          to: [2],
          content: "x",
          rendered_content: "<p>x</p>",
          scheduled_delivery_timestamp: 100,
          failed: false,
        },
      },
      loadStatus: "loaded",
    });
    emitInitialState();
    expect(useScheduledMessagesStore.getState().scheduledMessages).toEqual({});
    expect(useScheduledMessagesStore.getState().loadStatus).toBe("idle");
  });

  it("ignores event types a store does not own", () => {
    // A `typing` event touches none of the server-state stores.
    emitEvent({
      id: 8,
      type: "typing",
      op: "start",
      message_type: "stream",
      sender: { user_id: 1, email: "a@b.c" },
      stream_id: 1,
      topic: "t",
    });
    expect(useUsersStore.getState().users).toEqual({});
    expect(useMessagesStore.getState().messages).toEqual({});
  });
});

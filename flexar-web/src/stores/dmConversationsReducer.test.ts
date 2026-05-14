// Unit tests for the DM conversations reducers
// (`src/stores/dmConversationsReducer`).
//
// Covers projecting the register snapshot's `recent_private_
// conversations` into a recency-ordered list (with the viewer id mixed
// into each key), and folding DM-type `message` events on top — bumping
// an existing conversation's recency or inserting a new one.

import { describe, expect, it } from "vitest";
import type { DirectMessageRecipient, MessageEvent } from "../domain";
import {
  applyMessageEventToDmConversations,
  conversationsByRecency,
  dmConversationsFromInitialState,
  type DmConversation,
} from "./dmConversationsReducer";
import { makeInitialState, makeMessage } from "./testFixtures";

// Build a `display_recipient` participant list for a DM `Message`.
function recipients(...ids: number[]): DirectMessageRecipient[] {
  return ids.map((id) => ({
    id,
    email: `user${id}@example.com`,
    full_name: `User ${id}`,
    is_mirror_dummy: false,
  }));
}

// A `message` event carrying a direct message to the given participants.
function dmMessageEvent(id: number, participantIds: number[]): MessageEvent {
  return {
    id: 1,
    type: "message",
    message: makeMessage({
      id,
      type: "private",
      subject: "",
      display_recipient: recipients(...participantIds),
    }),
    flags: [],
  };
}

describe("dmConversationsFromInitialState", () => {
  it("projects recent_private_conversations, viewer id mixed into each key", () => {
    const conversations = dmConversationsFromInitialState(
      makeInitialState({
        recent_private_conversations: [
          { max_message_id: 50, user_ids: [2] },
          { max_message_id: 90, user_ids: [3, 4] },
        ],
      }),
      1,
    );
    // Ordered most-recent-first by max_message_id.
    expect(conversations.map((c) => c.conversationKey)).toEqual([
      "1,3,4",
      "1,2",
    ]);
    expect(conversations[0].maxMessageId).toBe(90);
    expect(conversations[1].participantIds).toEqual([1, 2]);
  });

  it("keys a self-DM (empty user_ids) by the viewer id alone", () => {
    const conversations = dmConversationsFromInitialState(
      makeInitialState({
        recent_private_conversations: [
          { max_message_id: 10, user_ids: [] },
        ],
      }),
      5,
    );
    expect(conversations[0].conversationKey).toBe("5");
  });

  it("omits the viewer id when it is not yet known", () => {
    const conversations = dmConversationsFromInitialState(
      makeInitialState({
        recent_private_conversations: [
          { max_message_id: 10, user_ids: [2, 3] },
        ],
      }),
      null,
    );
    expect(conversations[0].conversationKey).toBe("2,3");
  });

  it("returns an empty list when the key is absent", () => {
    expect(
      dmConversationsFromInitialState(makeInitialState(), 1),
    ).toEqual([]);
  });
});

describe("applyMessageEventToDmConversations", () => {
  it("inserts a brand-new conversation at the front", () => {
    const seeded: DmConversation[] = [
      { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 10 },
    ];
    const next = applyMessageEventToDmConversations(
      seeded,
      dmMessageEvent(20, [1, 3]),
    );
    expect(next.map((c) => c.conversationKey)).toEqual(["1,3", "1,2"]);
  });

  it("bumps an existing conversation's recency and re-sorts it", () => {
    const seeded: DmConversation[] = [
      { conversationKey: "1,3", participantIds: [1, 3], maxMessageId: 30 },
      { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 20 },
    ];
    const next = applyMessageEventToDmConversations(
      seeded,
      dmMessageEvent(40, [1, 2]),
    );
    expect(next.map((c) => c.conversationKey)).toEqual(["1,2", "1,3"]);
    expect(next[0].maxMessageId).toBe(40);
  });

  it("ignores a channel message", () => {
    const seeded: DmConversation[] = [];
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 5, type: "stream" }),
      flags: [],
    };
    expect(applyMessageEventToDmConversations(seeded, event)).toBe(seeded);
  });

  it("is a no-op for an out-of-order message that does not advance recency", () => {
    const seeded: DmConversation[] = [
      { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 50 },
    ];
    expect(
      applyMessageEventToDmConversations(seeded, dmMessageEvent(40, [1, 2])),
    ).toBe(seeded);
  });

  it("does not mutate the input list", () => {
    const seeded: DmConversation[] = [
      { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 10 },
    ];
    applyMessageEventToDmConversations(seeded, dmMessageEvent(20, [1, 3]));
    expect(seeded).toHaveLength(1);
  });
});

describe("conversationsByRecency", () => {
  it("orders conversations most-recent-first by maxMessageId", () => {
    const out = conversationsByRecency([
      { conversationKey: "1,2", participantIds: [1, 2], maxMessageId: 10 },
      { conversationKey: "1,3", participantIds: [1, 3], maxMessageId: 90 },
      { conversationKey: "1,4", participantIds: [1, 4], maxMessageId: 50 },
    ]);
    expect(out.map((c) => c.maxMessageId)).toEqual([90, 50, 10]);
  });
});

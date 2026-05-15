// Unit tests for the messages reducers (`src/stores/messagesReducer`).
//
// The messages store has no initial-state hydration, so the suite
// covers `ingestMessages` (the Phase 1.6 seam) and each event reducer:
// new messages, edits/moves/re-renders, deletions, reaction add/remove,
// and flag add/remove — including the no-op edge cases (events for
// uncached messages, idempotent reaction adds, `all: true` flags).

import { describe, expect, it } from "vitest";
import type {
  DeleteMessageEvent,
  MessageEvent,
  ReactionEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
} from "../domain";
import {
  applyDeleteMessageEvent,
  applyMessageEvent,
  applyReactionEvent,
  applyUpdateMessageEvent,
  applyUpdateMessageFlagsEvent,
  emptyMessagesSnapshot,
  ingestMessages,
  insertOptimisticMessage,
  reconcileOptimisticMessage,
  removeOptimisticMessage,
  type MessagesSnapshot,
} from "./messagesReducer";
import { makeMessage, makeReaction } from "./testFixtures";

/** A snapshot seeded with the given messages (no flags). */
function withMessages(
  ...ids: number[]
): MessagesSnapshot {
  const snapshot = emptyMessagesSnapshot();
  for (const id of ids) {
    snapshot.messages[id] = makeMessage({ id });
  }
  return snapshot;
}

describe("ingestMessages", () => {
  it("bulk-inserts messages into the cache", () => {
    const next = ingestMessages(emptyMessagesSnapshot(), [
      makeMessage({ id: 1 }),
      makeMessage({ id: 2 }),
    ]);
    expect(Object.keys(next.messages).sort()).toEqual(["1", "2"]);
  });

  it("merges per-message flags when supplied", () => {
    const next = ingestMessages(
      emptyMessagesSnapshot(),
      [makeMessage({ id: 1 })],
      { 1: ["read", "starred"] },
    );
    expect(next.flags[1]).toEqual(["read", "starred"]);
  });

  it("is a no-op for an empty batch", () => {
    const snapshot = emptyMessagesSnapshot();
    expect(ingestMessages(snapshot, [])).toBe(snapshot);
  });

  it("does not mutate the input snapshot", () => {
    const snapshot = emptyMessagesSnapshot();
    ingestMessages(snapshot, [makeMessage({ id: 1 })]);
    expect(snapshot.messages).toEqual({});
  });
});

describe("applyMessageEvent", () => {
  it("stores the message and its flags", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42 }),
      flags: ["mentioned"],
    };
    const next = applyMessageEvent(emptyMessagesSnapshot(), event);
    expect(next.messages[42].id).toBe(42);
    expect(next.flags[42]).toEqual(["mentioned"]);
  });
});

describe("applyUpdateMessageEvent — content edit", () => {
  it("updates rendered content and last_edit_timestamp on the edited message", () => {
    const snapshot = withMessages(42);
    const event: UpdateMessageEvent = {
      id: 1,
      type: "update_message",
      user_id: 1,
      rendering_only: false,
      message_id: 42,
      message_ids: [42],
      flags: [],
      edit_timestamp: 5000,
      rendered_content: "<p>edited</p>",
    };
    const next = applyUpdateMessageEvent(snapshot, event);
    expect(next.messages[42].content).toBe("<p>edited</p>");
    expect(next.messages[42].last_edit_timestamp).toBe(5000);
  });

  it("a rendering-only update does not set last_edit_timestamp", () => {
    const snapshot = withMessages(42);
    const next = applyUpdateMessageEvent(snapshot, {
      id: 1,
      type: "update_message",
      user_id: null,
      rendering_only: true,
      message_id: 42,
      message_ids: [42],
      flags: [],
      edit_timestamp: 5000,
      rendered_content: "<p>with preview</p>",
    });
    expect(next.messages[42].content).toBe("<p>with preview</p>");
    expect(next.messages[42].last_edit_timestamp).toBeUndefined();
  });
});

describe("applyUpdateMessageEvent — topic / channel move", () => {
  it("applies a topic move to every id in message_ids", () => {
    const snapshot = withMessages(1, 2, 3);
    const next = applyUpdateMessageEvent(snapshot, {
      id: 1,
      type: "update_message",
      user_id: 1,
      rendering_only: false,
      message_id: 1,
      message_ids: [1, 2, 3],
      flags: [],
      edit_timestamp: 5000,
      orig_subject: "old",
      subject: "new topic",
      propagate_mode: "change_all",
    });
    for (const id of [1, 2, 3]) {
      expect(next.messages[id].subject).toBe("new topic");
      expect(next.messages[id].last_moved_timestamp).toBe(5000);
    }
  });

  it("applies a channel move to message_ids", () => {
    const snapshot = withMessages(1, 2);
    const next = applyUpdateMessageEvent(snapshot, {
      id: 1,
      type: "update_message",
      user_id: 1,
      rendering_only: false,
      message_id: 1,
      message_ids: [1, 2],
      flags: [],
      edit_timestamp: 5000,
      stream_id: 10,
      new_stream_id: 20,
    });
    expect(next.messages[1].stream_id).toBe(20);
    expect(next.messages[2].stream_id).toBe(20);
  });

  it("skips message ids that are not in the cache", () => {
    const snapshot = withMessages(1);
    const next = applyUpdateMessageEvent(snapshot, {
      id: 1,
      type: "update_message",
      user_id: 1,
      rendering_only: false,
      message_id: 1,
      message_ids: [1, 999],
      flags: [],
      edit_timestamp: 5000,
      subject: "new topic",
    });
    expect(next.messages[1].subject).toBe("new topic");
    expect(999 in next.messages).toBe(false);
  });

  it("is a no-op when the edited message is not cached", () => {
    const snapshot = withMessages(1);
    const next = applyUpdateMessageEvent(snapshot, {
      id: 1,
      type: "update_message",
      user_id: 1,
      rendering_only: false,
      message_id: 999,
      message_ids: [999],
      flags: [],
      edit_timestamp: 5000,
      rendered_content: "<p>x</p>",
    });
    expect(next).toBe(snapshot);
  });
});

describe("applyDeleteMessageEvent", () => {
  it("drops a single message (non-bulk message_id)", () => {
    const snapshot = withMessages(1, 2);
    const event: DeleteMessageEvent = {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_id: 1,
      stream_id: 10,
      topic: "t",
    };
    const next = applyDeleteMessageEvent(snapshot, event);
    expect(1 in next.messages).toBe(false);
    expect(2 in next.messages).toBe(true);
  });

  it("drops multiple messages (bulk message_ids) and their flags", () => {
    const snapshot = withMessages(1, 2, 3);
    snapshot.flags[1] = ["read"];
    const next = applyDeleteMessageEvent(snapshot, {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [1, 2],
    });
    expect(Object.keys(next.messages)).toEqual(["3"]);
    expect(1 in next.flags).toBe(false);
  });

  it("is a no-op for unknown ids", () => {
    const snapshot = withMessages(1);
    const next = applyDeleteMessageEvent(snapshot, {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [999],
    });
    expect(next).toBe(snapshot);
  });
});

describe("applyReactionEvent", () => {
  it("add appends the reaction to the message", () => {
    const snapshot = withMessages(1);
    const event: ReactionEvent = {
      id: 1,
      type: "reaction",
      op: "add",
      message_id: 1,
      user_id: 7,
      emoji_name: "tada",
      emoji_code: "1f389",
      reaction_type: "unicode_emoji",
    };
    const next = applyReactionEvent(snapshot, event);
    expect(next.messages[1].reactions).toEqual([
      {
        user_id: 7,
        emoji_name: "tada",
        emoji_code: "1f389",
        reaction_type: "unicode_emoji",
      },
    ]);
  });

  it("add is idempotent for the same user + emoji", () => {
    const snapshot = withMessages(1);
    snapshot.messages[1] = makeMessage({
      id: 1,
      reactions: [
        makeReaction({ user_id: 7, emoji_code: "1f389", emoji_name: "tada" }),
      ],
    });
    const next = applyReactionEvent(snapshot, {
      id: 1,
      type: "reaction",
      op: "add",
      message_id: 1,
      user_id: 7,
      emoji_name: "tada",
      emoji_code: "1f389",
      reaction_type: "unicode_emoji",
    });
    expect(next).toBe(snapshot);
  });

  it("remove drops the matching reaction", () => {
    const snapshot = withMessages(1);
    snapshot.messages[1] = makeMessage({
      id: 1,
      reactions: [
        makeReaction({ user_id: 7, emoji_code: "1f389" }),
        makeReaction({ user_id: 8, emoji_code: "1f389" }),
      ],
    });
    const next = applyReactionEvent(snapshot, {
      id: 1,
      type: "reaction",
      op: "remove",
      message_id: 1,
      user_id: 7,
      emoji_name: "tada",
      emoji_code: "1f389",
      reaction_type: "unicode_emoji",
    });
    expect(next.messages[1].reactions).toEqual([
      makeReaction({ user_id: 8, emoji_code: "1f389" }),
    ]);
  });

  it("remove of an absent reaction is a no-op", () => {
    const snapshot = withMessages(1);
    const next = applyReactionEvent(snapshot, {
      id: 1,
      type: "reaction",
      op: "remove",
      message_id: 1,
      user_id: 7,
      emoji_name: "tada",
      emoji_code: "1f389",
      reaction_type: "unicode_emoji",
    });
    expect(next).toBe(snapshot);
  });

  it("a reaction for an uncached message is a no-op", () => {
    const snapshot = emptyMessagesSnapshot();
    const next = applyReactionEvent(snapshot, {
      id: 1,
      type: "reaction",
      op: "add",
      message_id: 999,
      user_id: 7,
      emoji_name: "tada",
      emoji_code: "1f389",
      reaction_type: "unicode_emoji",
    });
    expect(next).toBe(snapshot);
  });
});

describe("applyUpdateMessageFlagsEvent", () => {
  it("add appends a flag to each listed message", () => {
    const snapshot = withMessages(1, 2);
    const event: UpdateMessageFlagsEvent = {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [1, 2],
      all: false,
    };
    const next = applyUpdateMessageFlagsEvent(snapshot, event);
    expect(next.flags[1]).toEqual(["read"]);
    expect(next.flags[2]).toEqual(["read"]);
  });

  it("add is idempotent for a flag already present", () => {
    const snapshot = withMessages(1);
    snapshot.flags[1] = ["read"];
    const next = applyUpdateMessageFlagsEvent(snapshot, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [1],
      all: false,
    });
    expect(next).toBe(snapshot);
  });

  it("add with all: true flags every cached message", () => {
    const snapshot = withMessages(1, 2, 3);
    const next = applyUpdateMessageFlagsEvent(snapshot, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [],
      all: true,
    });
    expect(next.flags[1]).toEqual(["read"]);
    expect(next.flags[2]).toEqual(["read"]);
    expect(next.flags[3]).toEqual(["read"]);
  });

  it("remove drops the flag from each listed message", () => {
    const snapshot = withMessages(1);
    snapshot.flags[1] = ["read", "starred"];
    const next = applyUpdateMessageFlagsEvent(snapshot, {
      id: 1,
      type: "update_message_flags",
      op: "remove",
      flag: "starred",
      messages: [1],
      all: false,
    });
    expect(next.flags[1]).toEqual(["read"]);
  });

  it("remove of an absent flag is a no-op", () => {
    const snapshot = withMessages(1);
    snapshot.flags[1] = ["read"];
    const next = applyUpdateMessageFlagsEvent(snapshot, {
      id: 1,
      type: "update_message_flags",
      op: "remove",
      flag: "starred",
      messages: [1],
      all: false,
    });
    expect(next).toBe(snapshot);
  });

  it("tracks flags for messages not yet in the cache", () => {
    const snapshot = emptyMessagesSnapshot();
    const next = applyUpdateMessageFlagsEvent(snapshot, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [999],
      all: false,
    });
    expect(next.flags[999]).toEqual(["read"]);
  });
});

describe("optimistic-echo helpers (Phase 2.2)", () => {
  it("insertOptimisticMessage adds the message under its (negative) id", () => {
    const next = insertOptimisticMessage(
      emptyMessagesSnapshot(),
      makeMessage({ id: -1, content: "hello" }),
    );
    expect(next.messages[-1].content).toBe("hello");
    expect(next.flags[-1]).toBeUndefined();
  });

  it("insertOptimisticMessage stores flags when supplied", () => {
    const next = insertOptimisticMessage(
      emptyMessagesSnapshot(),
      makeMessage({ id: -2 }),
      ["read"],
    );
    expect(next.flags[-2]).toEqual(["read"]);
  });

  it("insertOptimisticMessage does not mutate the input snapshot", () => {
    const snapshot = emptyMessagesSnapshot();
    insertOptimisticMessage(snapshot, makeMessage({ id: -1 }));
    expect(snapshot.messages).toEqual({});
  });

  it("reconcileOptimisticMessage swaps the local id for the real one", () => {
    const seeded = insertOptimisticMessage(
      emptyMessagesSnapshot(),
      makeMessage({ id: -1, content: "hi" }),
      ["read"],
    );
    const next = reconcileOptimisticMessage(
      seeded,
      -1,
      makeMessage({ id: 42, content: "hi" }),
    );
    expect(next.messages[-1]).toBeUndefined();
    expect(next.flags[-1]).toBeUndefined();
    expect(next.messages[42].content).toBe("hi");
  });

  it("reconcileOptimisticMessage preserves an event-arrived-first cache entry", () => {
    // The `message` event raced ahead: id 42 is already in the cache
    // (with viewer flags). reconcile must drop the optimistic entry but
    // keep the canonical entry the event installed — not clobber it.
    const seeded = insertOptimisticMessage(
      emptyMessagesSnapshot(),
      makeMessage({ id: -1 }),
    );
    const withRealEntry = applyMessageEvent(seeded, {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, content: "from event" }),
      flags: ["mentioned"],
    });
    const next = reconcileOptimisticMessage(
      withRealEntry,
      -1,
      makeMessage({ id: 42, content: "from rest" }),
    );
    expect(next.messages[-1]).toBeUndefined();
    // Event's content + flags survive — the REST response does not
    // overwrite them.
    expect(next.messages[42].content).toBe("from event");
    expect(next.flags[42]).toEqual(["mentioned"]);
  });

  it("reconcileOptimisticMessage tolerates an unknown local id", () => {
    // The optimistic entry was already removed (e.g. by a prior failure
    // path); reconcile should still install the real message cleanly.
    const next = reconcileOptimisticMessage(
      emptyMessagesSnapshot(),
      -99,
      makeMessage({ id: 7, content: "ok" }),
    );
    expect(next.messages[7].content).toBe("ok");
  });

  it("removeOptimisticMessage drops the entry and its flags", () => {
    const seeded = insertOptimisticMessage(
      emptyMessagesSnapshot(),
      makeMessage({ id: -1 }),
      ["read"],
    );
    const next = removeOptimisticMessage(seeded, -1);
    expect(next.messages[-1]).toBeUndefined();
    expect(next.flags[-1]).toBeUndefined();
  });

  it("removeOptimisticMessage is a no-op for an unknown id", () => {
    const snapshot = emptyMessagesSnapshot();
    expect(removeOptimisticMessage(snapshot, -99)).toBe(snapshot);
  });
});

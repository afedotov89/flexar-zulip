// Unit tests for the unread reducers (`src/stores/unreadReducer`).
//
// Covers flattening the `unread_msgs` buckets on hydration, and each
// unread-affecting event: `message` (with the own-sender and
// already-read exclusions), `update_message_flags` for the `read` flag
// (including `all: true`), and `delete_message`.

import { describe, expect, it } from "vitest";
import type {
  DeleteMessageEvent,
  MessageEvent,
  UpdateMessageFlagsEvent,
} from "../domain";
import { makeInitialState, makeMessage } from "./testFixtures";
import {
  applyDeleteMessageEventToUnread,
  applyMessageEventToUnread,
  applyUpdateMessageFlagsEventToUnread,
  unreadCount,
  unreadFromInitialState,
  type UnreadSet,
} from "./unreadReducer";

describe("unreadFromInitialState", () => {
  it("flattens pms, streams, huddles and mentions into one id set", () => {
    const unread = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 5,
          pms: [{ other_user_id: 2, unread_message_ids: [10, 11] }],
          streams: [
            { stream_id: 1, topic: "t", unread_message_ids: [20, 21] },
          ],
          huddles: [{ user_ids_string: "1,2,3", unread_message_ids: [30] }],
          mentions: [20],
          old_unreads_missing: false,
        },
      }),
    );
    expect(Object.keys(unread).sort()).toEqual(["10", "11", "20", "21", "30"]);
  });

  it("returns an empty set when unread_msgs is absent", () => {
    expect(unreadFromInitialState(makeInitialState())).toEqual({});
  });

  it("tolerates an unread_msgs object with missing buckets", () => {
    const unread = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 0,
          streams: [{ stream_id: 1, topic: "t", unread_message_ids: [7] }],
        },
      }),
    );
    expect(unread).toEqual({ 7: true });
  });
});

describe("applyMessageEventToUnread", () => {
  it("marks a received message unread", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, sender_id: 99 }),
      flags: [],
    };
    const next = applyMessageEventToUnread({}, event, 1);
    expect(next).toEqual({ 42: true });
  });

  it("does not mark the viewer's own message unread", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, sender_id: 1 }),
      flags: [],
    };
    const next = applyMessageEventToUnread({}, event, 1);
    expect(next).toEqual({});
  });

  it("does not mark an already-read message unread", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, sender_id: 99 }),
      flags: ["read"],
    };
    const next = applyMessageEventToUnread({}, event, 1);
    expect(next).toEqual({});
  });

  it("treats a message as unread when the viewer id is not yet known", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, sender_id: 99 }),
      flags: [],
    };
    const next = applyMessageEventToUnread({}, event, null);
    expect(next).toEqual({ 42: true });
  });

  it("is a no-op when the message id is already in the set", () => {
    const set: UnreadSet = { 42: true };
    const next = applyMessageEventToUnread(
      set,
      {
        id: 1,
        type: "message",
        message: makeMessage({ id: 42, sender_id: 99 }),
        flags: [],
      },
      1,
    );
    expect(next).toBe(set);
  });
});

describe("applyUpdateMessageFlagsEventToUnread", () => {
  it("add of the read flag removes the listed ids", () => {
    const set: UnreadSet = { 1: true, 2: true, 3: true };
    const event: UpdateMessageFlagsEvent = {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [1, 2],
      all: false,
    };
    const next = applyUpdateMessageFlagsEventToUnread(set, event);
    expect(next).toEqual({ 3: true });
  });

  it("add of the read flag with all: true clears the whole set", () => {
    const set: UnreadSet = { 1: true, 2: true };
    const next = applyUpdateMessageFlagsEventToUnread(set, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [],
      all: true,
    });
    expect(next).toEqual({});
  });

  it("remove of the read flag re-adds the listed ids as unread", () => {
    const set: UnreadSet = { 1: true };
    const next = applyUpdateMessageFlagsEventToUnread(set, {
      id: 1,
      type: "update_message_flags",
      op: "remove",
      flag: "read",
      messages: [1, 2],
      all: false,
    });
    expect(next).toEqual({ 1: true, 2: true });
  });

  it("ignores flags other than read", () => {
    const set: UnreadSet = { 1: true };
    const next = applyUpdateMessageFlagsEventToUnread(set, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "starred",
      messages: [1],
      all: false,
    });
    expect(next).toBe(set);
  });

  it("add of read for ids not in the set is a no-op", () => {
    const set: UnreadSet = { 1: true };
    const next = applyUpdateMessageFlagsEventToUnread(set, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [999],
      all: false,
    });
    expect(next).toBe(set);
  });
});

describe("applyDeleteMessageEventToUnread", () => {
  it("drops deleted message ids from the set (bulk message_ids)", () => {
    const set: UnreadSet = { 1: true, 2: true, 3: true };
    const event: DeleteMessageEvent = {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [1, 2],
    };
    const next = applyDeleteMessageEventToUnread(set, event);
    expect(next).toEqual({ 3: true });
  });

  it("drops a single deleted message id (non-bulk message_id)", () => {
    const set: UnreadSet = { 1: true, 2: true };
    const next = applyDeleteMessageEventToUnread(set, {
      id: 1,
      type: "delete_message",
      message_type: "private",
      message_id: 1,
    });
    expect(next).toEqual({ 2: true });
  });

  it("is a no-op when no deleted id was unread", () => {
    const set: UnreadSet = { 1: true };
    const next = applyDeleteMessageEventToUnread(set, {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [999],
    });
    expect(next).toBe(set);
  });
});

describe("unreadCount", () => {
  it("counts the ids in the set", () => {
    expect(unreadCount({})).toBe(0);
    expect(unreadCount({ 1: true, 2: true, 3: true })).toBe(3);
  });
});

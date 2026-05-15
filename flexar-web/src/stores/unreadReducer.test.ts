// Unit tests for the unread reducers (`src/stores/unreadReducer`).
//
// The unread store keeps unread messages bucketed per channel-topic and
// per DM conversation (Phase 1.5). This suite covers bucketing a
// register snapshot's `unread_msgs` on hydration, every unread-affecting
// event — `message`, `update_message` (topic/channel moves),
// `update_message_flags` (the `read` flag, including `all: true`),
// `delete_message` — and the count/selector helpers over the buckets.

import { describe, expect, it } from "vitest";
import type {
  DeleteMessageEvent,
  DirectMessageRecipient,
  MessageEvent,
  UpdateMessageEvent,
  UpdateMessageFlagsEvent,
} from "../domain";
import { makeInitialState, makeMessage } from "./testFixtures";
import {
  applyDeleteMessageEventToUnread,
  applyMessageEventToUnread,
  applyUpdateMessageEventToUnread,
  applyUpdateMessageFlagsEventToUnread,
  channelUnreadCount,
  dmConversationKey,
  dmConversationKeysWithUnread,
  dmUnreadCount,
  emptyUnreadBuckets,
  isUnread,
  markIdsRead,
  mentionsCount,
  topicUnreadCount,
  unreadCount,
  unreadFromInitialState,
  type UnreadBuckets,
} from "./unreadReducer";

// Build a `display_recipient` participant list for a DM `Message`.
function recipients(...ids: number[]): DirectMessageRecipient[] {
  return ids.map((id) => ({
    id,
    email: `user${id}@example.com`,
    full_name: `User ${id}`,
    is_mirror_dummy: false,
  }));
}

// A `message` event carrying a channel message in a given topic.
function channelMessageEvent(
  id: number,
  streamId: number,
  topic: string,
  senderId = 99,
): MessageEvent {
  return {
    id: 1,
    type: "message",
    message: makeMessage({
      id,
      type: "stream",
      stream_id: streamId,
      subject: topic,
      sender_id: senderId,
    }),
    flags: [],
  };
}

// A `message` event carrying a direct message to the given participants.
function dmMessageEvent(
  id: number,
  participantIds: number[],
  senderId = 99,
): MessageEvent {
  return {
    id: 1,
    type: "message",
    message: makeMessage({
      id,
      type: "private",
      subject: "",
      display_recipient: recipients(...participantIds),
      sender_id: senderId,
    }),
    flags: [],
  };
}

describe("dmConversationKey", () => {
  it("sorts, de-duplicates, and comma-joins participant ids", () => {
    expect(dmConversationKey([7, 2, 7, 4])).toBe("2,4,7");
  });

  it("yields a single-id key for a self-DM", () => {
    expect(dmConversationKey([5, 5])).toBe("5");
  });
});

describe("unreadFromInitialState", () => {
  it("buckets streams into channel-topic, pms and huddles into DMs", () => {
    const buckets = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 6,
          pms: [{ other_user_id: 2, unread_message_ids: [10, 11] }],
          streams: [
            { stream_id: 1, topic: "alpha", unread_message_ids: [20, 21] },
            { stream_id: 1, topic: "beta", unread_message_ids: [22] },
          ],
          huddles: [{ user_ids_string: "1,2,3", unread_message_ids: [30] }],
          mentions: [20],
          old_unreads_missing: false,
        },
      }),
      1,
    );
    expect(unreadCount(buckets)).toBe(6);
    expect(topicUnreadCount(buckets, 1, "alpha")).toBe(2);
    expect(topicUnreadCount(buckets, 1, "beta")).toBe(1);
    expect(channelUnreadCount(buckets, 1)).toBe(3);
    // The `pms` bucket key mixes in the viewer id (1) with other_user (2).
    expect(dmUnreadCount(buckets, "1,2")).toBe(2);
    expect(dmUnreadCount(buckets, "1,2,3")).toBe(1);
  });

  it("buckets pms with only the other id when the viewer id is unknown", () => {
    const buckets = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 1,
          pms: [{ other_user_id: 2, unread_message_ids: [10] }],
        },
      }),
      null,
    );
    expect(dmUnreadCount(buckets, "2")).toBe(1);
  });

  it("returns empty buckets when unread_msgs is absent", () => {
    expect(unreadFromInitialState(makeInitialState(), 1)).toEqual(
      emptyUnreadBuckets(),
    );
  });

  it("tolerates an unread_msgs object with missing buckets", () => {
    const buckets = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 0,
          streams: [{ stream_id: 1, topic: "t", unread_message_ids: [7] }],
        },
      }),
      1,
    );
    expect(unreadCount(buckets)).toBe(1);
    expect(topicUnreadCount(buckets, 1, "t")).toBe(1);
  });
});

describe("applyMessageEventToUnread", () => {
  it("files a received channel message into its channel-topic bucket", () => {
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general"),
      1,
    );
    expect(topicUnreadCount(next, 5, "general")).toBe(1);
    expect(isUnread(next, 42)).toBe(true);
  });

  it("files a received direct message into its DM bucket", () => {
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      dmMessageEvent(43, [1, 2]),
      1,
    );
    expect(dmUnreadCount(next, "1,2")).toBe(1);
    expect(isUnread(next, 43)).toBe(true);
  });

  it("does not mark the viewer's own message unread", () => {
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general", 1),
      1,
    );
    expect(unreadCount(next)).toBe(0);
  });

  it("does not mark an already-read message unread", () => {
    const event = channelMessageEvent(42, 5, "general");
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      { ...event, flags: ["read"] },
      1,
    );
    expect(unreadCount(next)).toBe(0);
  });

  it("treats a message as unread when the viewer id is not yet known", () => {
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general"),
      null,
    );
    expect(isUnread(next, 42)).toBe(true);
  });

  it("is a no-op when the message id is already tracked", () => {
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general"),
      1,
    );
    const next = applyMessageEventToUnread(
      buckets,
      channelMessageEvent(42, 5, "general"),
      1,
    );
    expect(next).toBe(buckets);
  });

  it("ignores a channel message with no stream_id", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 42, type: "stream", stream_id: undefined }),
      flags: [],
    };
    const next = applyMessageEventToUnread(emptyUnreadBuckets(), event, 1);
    expect(unreadCount(next)).toBe(0);
  });
});

describe("applyUpdateMessageEventToUnread", () => {
  // Buckets holding one unread channel message, id 50, in stream 1 / "old".
  function seeded(): UnreadBuckets {
    return applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(50, 1, "old"),
      1,
    );
  }

  it("re-buckets a message moved to a new topic in the same channel", () => {
    const event: UpdateMessageEvent = {
      id: 2,
      type: "update_message",
      user_id: 9,
      rendering_only: false,
      message_id: 50,
      message_ids: [50],
      flags: [],
      edit_timestamp: 1000,
      subject: "new",
    };
    const next = applyUpdateMessageEventToUnread(seeded(), event);
    expect(topicUnreadCount(next, 1, "old")).toBe(0);
    expect(topicUnreadCount(next, 1, "new")).toBe(1);
  });

  it("re-buckets a message moved to a different channel", () => {
    const event: UpdateMessageEvent = {
      id: 2,
      type: "update_message",
      user_id: 9,
      rendering_only: false,
      message_id: 50,
      message_ids: [50],
      flags: [],
      edit_timestamp: 1000,
      new_stream_id: 7,
    };
    const next = applyUpdateMessageEventToUnread(seeded(), event);
    expect(channelUnreadCount(next, 1)).toBe(0);
    expect(topicUnreadCount(next, 7, "old")).toBe(1);
  });

  it("ignores a content edit (no topic or channel move)", () => {
    const buckets = seeded();
    const event: UpdateMessageEvent = {
      id: 2,
      type: "update_message",
      user_id: 9,
      rendering_only: false,
      message_id: 50,
      message_ids: [50],
      flags: [],
      edit_timestamp: 1000,
      content: "edited",
      rendered_content: "<p>edited</p>",
    };
    expect(applyUpdateMessageEventToUnread(buckets, event)).toBe(buckets);
  });

  it("leaves already-read (untracked) moved ids alone", () => {
    const event: UpdateMessageEvent = {
      id: 2,
      type: "update_message",
      user_id: 9,
      rendering_only: false,
      message_id: 999,
      message_ids: [999],
      flags: [],
      edit_timestamp: 1000,
      subject: "new",
    };
    const buckets = seeded();
    const next = applyUpdateMessageEventToUnread(buckets, event);
    expect(unreadCount(next)).toBe(1);
    expect(topicUnreadCount(next, 1, "old")).toBe(1);
  });
});

describe("applyUpdateMessageFlagsEventToUnread", () => {
  // Buckets holding ids 1 and 2 in stream 9 / "t", and id 3 in a DM.
  function seeded(): UnreadBuckets {
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(1, 9, "t"),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      channelMessageEvent(2, 9, "t"),
      100,
    );
    return applyMessageEventToUnread(buckets, dmMessageEvent(3, [100, 5]), 100);
  }

  it("add of the read flag removes the listed ids from their buckets", () => {
    const event: UpdateMessageFlagsEvent = {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [1, 3],
      all: false,
    };
    const next = applyUpdateMessageFlagsEventToUnread(seeded(), event);
    expect(isUnread(next, 1)).toBe(false);
    expect(isUnread(next, 2)).toBe(true);
    expect(isUnread(next, 3)).toBe(false);
    expect(topicUnreadCount(next, 9, "t")).toBe(1);
    expect(dmUnreadCount(next, "5,100")).toBe(0);
  });

  it("add of the read flag with all: true clears every bucket", () => {
    const next = applyUpdateMessageFlagsEventToUnread(seeded(), {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [],
      all: true,
    });
    expect(next).toEqual(emptyUnreadBuckets());
  });

  it("remove of the read flag re-files ids whose bucket is still known", () => {
    // An id whose `location` is still tracked is re-filed into the same
    // bucket — a no-op in practice, but it confirms `remove` consults
    // the reverse index rather than dropping ids.
    const buckets = seeded();
    const next = applyUpdateMessageFlagsEventToUnread(buckets, {
      id: 2,
      type: "update_message_flags",
      op: "remove",
      flag: "read",
      messages: [1],
      all: false,
    });
    expect(isUnread(next, 1)).toBe(true);
    expect(topicUnreadCount(next, 9, "t")).toBe(2);
  });

  it("remove of the read flag cannot restore an id with no known bucket", () => {
    // Once `add` read forgets an id's bucket, a later `remove` for it
    // has nothing to re-file — the event carries no channel/topic. The
    // server's reconnect snapshot is what re-establishes such buckets.
    const buckets = seeded();
    const forgotten = applyUpdateMessageFlagsEventToUnread(buckets, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [1],
      all: false,
    });
    const next = applyUpdateMessageFlagsEventToUnread(forgotten, {
      id: 2,
      type: "update_message_flags",
      op: "remove",
      flag: "read",
      messages: [1],
      all: false,
    });
    expect(isUnread(next, 1)).toBe(false);
    expect(unreadCount(next)).toBe(2);
  });

  it("ignores flags other than read", () => {
    const buckets = seeded();
    expect(
      applyUpdateMessageFlagsEventToUnread(buckets, {
        id: 1,
        type: "update_message_flags",
        op: "add",
        flag: "starred",
        messages: [1],
        all: false,
      }),
    ).toBe(buckets);
  });
});

describe("applyDeleteMessageEventToUnread", () => {
  function seeded(): UnreadBuckets {
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(1, 9, "t"),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      channelMessageEvent(2, 9, "t"),
      100,
    );
    return applyMessageEventToUnread(buckets, channelMessageEvent(3, 9, "t"), 100);
  }

  it("drops deleted message ids from their buckets (bulk message_ids)", () => {
    const event: DeleteMessageEvent = {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [1, 2],
    };
    const next = applyDeleteMessageEventToUnread(seeded(), event);
    expect(topicUnreadCount(next, 9, "t")).toBe(1);
    expect(isUnread(next, 3)).toBe(true);
  });

  it("drops a single deleted message id (non-bulk message_id)", () => {
    const next = applyDeleteMessageEventToUnread(seeded(), {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_id: 1,
    });
    expect(isUnread(next, 1)).toBe(false);
    expect(unreadCount(next)).toBe(2);
  });

  it("prunes a channel bucket that empties out", () => {
    const next = applyDeleteMessageEventToUnread(seeded(), {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_ids: [1, 2, 3],
    });
    expect(channelUnreadCount(next, 9)).toBe(0);
    expect(next.channels[9]).toBeUndefined();
  });

  it("is a no-op when no deleted id was unread", () => {
    const buckets = seeded();
    expect(
      applyDeleteMessageEventToUnread(buckets, {
        id: 1,
        type: "delete_message",
        message_type: "stream",
        message_ids: [999],
      }),
    ).toBe(buckets);
  });
});

describe("mentions overlay", () => {
  it("hydrates the mentions overlay from unread_msgs.mentions", () => {
    const buckets = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 2,
          streams: [
            { stream_id: 1, topic: "t", unread_message_ids: [20, 21] },
          ],
          mentions: [20],
        },
      }),
      1,
    );
    expect(mentionsCount(buckets)).toBe(1);
    // The mentioned id is also filed into its channel-topic bucket.
    expect(isUnread(buckets, 20)).toBe(true);
  });

  it("leaves the overlay empty when unread_msgs has no mentions key", () => {
    const buckets = unreadFromInitialState(
      makeInitialState({
        unread_msgs: {
          count: 1,
          streams: [{ stream_id: 1, topic: "t", unread_message_ids: [7] }],
        },
      }),
      1,
    );
    expect(mentionsCount(buckets)).toBe(0);
  });

  it("adds a message id to the overlay when it carries the mentioned flag", () => {
    const event: MessageEvent = {
      ...channelMessageEvent(42, 5, "general"),
      flags: ["mentioned"],
    };
    const next = applyMessageEventToUnread(emptyUnreadBuckets(), event, 1);
    expect(mentionsCount(next)).toBe(1);
    expect(isUnread(next, 42)).toBe(true);
  });

  it("does not add an unmentioned message to the overlay", () => {
    const next = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general"),
      1,
    );
    expect(mentionsCount(next)).toBe(0);
  });

  it("reconciles the overlay even when the id is already tracked", () => {
    // A plain message lands first; a later event re-delivers it with
    // the `mentioned` flag — the overlay must still pick it up.
    const filed = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(42, 5, "general"),
      1,
    );
    const next = applyMessageEventToUnread(
      filed,
      { ...channelMessageEvent(42, 5, "general"), flags: ["mentioned"] },
      1,
    );
    expect(mentionsCount(next)).toBe(1);
  });

  it("removes a mention from the overlay when its message is read", () => {
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      { ...channelMessageEvent(42, 5, "general"), flags: ["mentioned"] },
      1,
    );
    const next = applyUpdateMessageFlagsEventToUnread(buckets, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [42],
      all: false,
    });
    expect(mentionsCount(next)).toBe(0);
    expect(isUnread(next, 42)).toBe(false);
  });

  it("clears the overlay on a read-all event", () => {
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      { ...channelMessageEvent(42, 5, "general"), flags: ["mentioned"] },
      1,
    );
    const next = applyUpdateMessageFlagsEventToUnread(buckets, {
      id: 1,
      type: "update_message_flags",
      op: "add",
      flag: "read",
      messages: [],
      all: true,
    });
    expect(mentionsCount(next)).toBe(0);
  });

  it("removes a mention from the overlay when its message is deleted", () => {
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      { ...channelMessageEvent(42, 5, "general"), flags: ["mentioned"] },
      1,
    );
    const next = applyDeleteMessageEventToUnread(buckets, {
      id: 1,
      type: "delete_message",
      message_type: "stream",
      message_id: 42,
    });
    expect(mentionsCount(next)).toBe(0);
  });
});

describe("markIdsRead", () => {
  it("drops the listed ids from their channel-topic buckets", () => {
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(1, 9, "release"),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      channelMessageEvent(2, 9, "release"),
      100,
    );

    buckets = markIdsRead(buckets, [1]);

    expect(isUnread(buckets, 1)).toBe(false);
    expect(isUnread(buckets, 2)).toBe(true);
    expect(topicUnreadCount(buckets, 9, "release")).toBe(1);
  });

  it("drops the listed ids from their DM buckets", () => {
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      dmMessageEvent(7, [100, 5]),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      dmMessageEvent(8, [100, 5]),
      100,
    );

    buckets = markIdsRead(buckets, [7, 8]);

    expect(dmUnreadCount(buckets, "5,100")).toBe(0);
    expect(dmConversationKeysWithUnread(buckets)).toEqual([]);
  });

  it("also clears the mentions overlay for marked ids", () => {
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({
        id: 5,
        type: "stream",
        stream_id: 9,
        subject: "release",
        sender_id: 99,
      }),
      flags: ["mentioned"],
    };
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      event,
      100,
    );
    expect(mentionsCount(buckets)).toBe(1);

    const next = markIdsRead(buckets, [5]);

    expect(mentionsCount(next)).toBe(0);
    expect(isUnread(next, 5)).toBe(false);
  });

  it("returns the same reference when nothing changes", () => {
    const buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(1, 9, "release"),
      100,
    );

    expect(markIdsRead(buckets, [])).toBe(buckets);
    expect(markIdsRead(buckets, [42])).toBe(buckets);
  });
});

describe("selectors", () => {
  it("unreadCount counts ids across all buckets", () => {
    expect(unreadCount(emptyUnreadBuckets())).toBe(0);
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      channelMessageEvent(1, 9, "t"),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      dmMessageEvent(2, [100, 5]),
      100,
    );
    expect(unreadCount(buckets)).toBe(2);
  });

  it("dmConversationKeysWithUnread lists DM conversations with unreads", () => {
    let buckets = applyMessageEventToUnread(
      emptyUnreadBuckets(),
      dmMessageEvent(1, [100, 5]),
      100,
    );
    buckets = applyMessageEventToUnread(
      buckets,
      dmMessageEvent(2, [100, 5, 6]),
      100,
    );
    expect(dmConversationKeysWithUnread(buckets).sort()).toEqual([
      "5,100",
      "5,6,100",
    ]);
  });

  it("channel/topic/dm counts are 0 for unknown buckets", () => {
    const buckets = emptyUnreadBuckets();
    expect(channelUnreadCount(buckets, 1)).toBe(0);
    expect(topicUnreadCount(buckets, 1, "t")).toBe(0);
    expect(dmUnreadCount(buckets, "1,2")).toBe(0);
  });
});

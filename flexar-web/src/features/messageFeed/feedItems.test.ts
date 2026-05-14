// Unit tests for the feed row derivation (`buildFeedRows`, Phase 1.6).
//
// `buildFeedRows` is the single source of truth for the feed's visual
// structure: recipient bars, date separators, and message rows with
// their grouping flags. These tests cover an empty window, a single
// message, sender grouping (and the breaks: sender change, time-window
// expiry, recipient change), recipient bars on every conversation
// change, and date separators across day boundaries.

import { describe, expect, it } from "vitest";
import type { Message } from "../../domain";
import {
  GROUP_WINDOW_SECONDS,
  buildFeedRows,
  sameRecipient,
  startOfLocalDay,
} from "./feedItems";

// Base timestamp: noon on a fixed local day, so adding small offsets
// stays within the same calendar day.
const NOON = startOfLocalDay(1_700_000_000) + 12 * 60 * 60;

function channelMessage(overrides: Partial<Message> & { id: number }): Message {
  return {
    type: "stream",
    content: "<p>hi</p>",
    content_type: "text/html",
    subject: "general",
    topic_links: [],
    stream_id: 7,
    display_recipient: "engineering",
    recipient_id: 100,
    sender_id: 1,
    sender_email: "user1@example.com",
    sender_full_name: "User 1",
    sender_realm_str: "flexar",
    avatar_url: null,
    timestamp: NOON,
    client: "test",
    is_me_message: false,
    reactions: [],
    submessages: [],
    ...overrides,
  };
}

function dmMessage(
  id: number,
  participantIds: number[],
  overrides: Partial<Message> = {},
): Message {
  return channelMessage({
    id,
    type: "private",
    subject: "",
    stream_id: undefined,
    display_recipient: participantIds.map((pid) => ({
      id: pid,
      email: `user${pid}@example.com`,
      full_name: `User ${pid}`,
      is_mirror_dummy: false,
    })),
    ...overrides,
  });
}

describe("buildFeedRows — trivial windows", () => {
  it("returns no rows for an empty window", () => {
    expect(buildFeedRows([])).toEqual([]);
  });

  it("emits a recipient bar then the message for a single message", () => {
    const rows = buildFeedRows([channelMessage({ id: 1 })]);
    expect(rows.map((r) => r.kind)).toEqual(["recipient-bar", "message"]);
    const messageRow = rows[1];
    expect(messageRow.kind === "message" && messageRow.isGroupStart).toBe(true);
    // No date separator before the very first row.
    expect(rows.some((r) => r.kind === "date-separator")).toBe(false);
  });
});

describe("buildFeedRows — sender grouping", () => {
  it("groups consecutive messages from the same sender in the window", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, sender_id: 1, timestamp: NOON }),
      channelMessage({ id: 2, sender_id: 1, timestamp: NOON + 30 }),
      channelMessage({ id: 3, sender_id: 1, timestamp: NOON + 60 }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      "recipient-bar",
      "message",
      "message",
      "message",
    ]);
    const groupStarts = rows
      .filter((r) => r.kind === "message")
      .map((r) => (r.kind === "message" ? r.isGroupStart : null));
    expect(groupStarts).toEqual([true, false, false]);
  });

  it("breaks the group when the sender changes", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, sender_id: 1, timestamp: NOON }),
      channelMessage({ id: 2, sender_id: 2, timestamp: NOON + 30 }),
    ]);
    const groupStarts = rows
      .filter((r) => r.kind === "message")
      .map((r) => (r.kind === "message" ? r.isGroupStart : null));
    expect(groupStarts).toEqual([true, true]);
  });

  it("breaks the group when the time window is exceeded", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, sender_id: 1, timestamp: NOON }),
      channelMessage({
        id: 2,
        sender_id: 1,
        timestamp: NOON + GROUP_WINDOW_SECONDS + 1,
      }),
    ]);
    const groupStarts = rows
      .filter((r) => r.kind === "message")
      .map((r) => (r.kind === "message" ? r.isGroupStart : null));
    expect(groupStarts).toEqual([true, true]);
  });

  it("keeps the group exactly at the window boundary", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, sender_id: 1, timestamp: NOON }),
      channelMessage({
        id: 2,
        sender_id: 1,
        timestamp: NOON + GROUP_WINDOW_SECONDS,
      }),
    ]);
    const second = rows[2];
    expect(second.kind === "message" && second.isGroupStart).toBe(false);
  });
});

describe("buildFeedRows — recipient bars", () => {
  it("emits a new bar when the topic changes within a channel", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, subject: "alpha" }),
      channelMessage({ id: 2, subject: "beta", sender_id: 1, timestamp: NOON }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      "recipient-bar",
      "message",
      "recipient-bar",
      "message",
    ]);
  });

  it("emits a new bar when switching from a channel to a DM", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1 }),
      dmMessage(2, [1, 2], { timestamp: NOON }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      "recipient-bar",
      "message",
      "recipient-bar",
      "message",
    ]);
  });

  it("does not emit a new bar for the same channel + topic", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, subject: "alpha", sender_id: 1 }),
      channelMessage({
        id: 2,
        subject: "alpha",
        sender_id: 2,
        timestamp: NOON + 10,
      }),
    ]);
    expect(rows.filter((r) => r.kind === "recipient-bar")).toHaveLength(1);
  });

  it("a recipient change forces a new sender-group even for the same sender", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, subject: "alpha", sender_id: 1, timestamp: NOON }),
      channelMessage({
        id: 2,
        subject: "beta",
        sender_id: 1,
        timestamp: NOON + 10,
      }),
    ]);
    const messageRows = rows.filter((r) => r.kind === "message");
    expect(
      messageRows.map((r) => (r.kind === "message" ? r.isGroupStart : null)),
    ).toEqual([true, true]);
  });
});

describe("buildFeedRows — date separators", () => {
  it("emits a separator between messages on different days", () => {
    const dayOne = NOON;
    const dayTwo = NOON + 24 * 60 * 60;
    const rows = buildFeedRows([
      channelMessage({ id: 1, timestamp: dayOne }),
      channelMessage({ id: 2, timestamp: dayTwo, sender_id: 1 }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual([
      "recipient-bar",
      "message",
      "date-separator",
      "message",
    ]);
    const separator = rows[2];
    expect(separator.kind === "date-separator" && separator.dayStart).toBe(
      startOfLocalDay(dayTwo),
    );
  });

  it("does not emit a separator before the first row", () => {
    const rows = buildFeedRows([channelMessage({ id: 1 })]);
    expect(rows.some((r) => r.kind === "date-separator")).toBe(false);
  });

  it("a day change forces a new sender-group for the same sender", () => {
    const rows = buildFeedRows([
      channelMessage({ id: 1, sender_id: 1, timestamp: NOON }),
      channelMessage({
        id: 2,
        sender_id: 1,
        timestamp: NOON + 24 * 60 * 60,
      }),
    ]);
    const messageRows = rows.filter((r) => r.kind === "message");
    expect(
      messageRows.map((r) => (r.kind === "message" ? r.isGroupStart : null)),
    ).toEqual([true, true]);
  });
});

describe("sameRecipient", () => {
  it("compares channel recipients by id and topic", () => {
    expect(
      sameRecipient(
        { type: "channel", streamId: 7, topic: "a" },
        { type: "channel", streamId: 7, topic: "a" },
      ),
    ).toBe(true);
    expect(
      sameRecipient(
        { type: "channel", streamId: 7, topic: "a" },
        { type: "channel", streamId: 7, topic: "b" },
      ),
    ).toBe(false);
  });

  it("compares DM recipients by participant set", () => {
    expect(
      sameRecipient(
        { type: "dm", participantIds: [1, 2] },
        { type: "dm", participantIds: [1, 2] },
      ),
    ).toBe(true);
    expect(
      sameRecipient(
        { type: "dm", participantIds: [1, 2] },
        { type: "dm", participantIds: [1, 3] },
      ),
    ).toBe(false);
  });

  it("never equates a channel with a DM", () => {
    expect(
      sameRecipient(
        { type: "channel", streamId: 7, topic: "a" },
        { type: "dm", participantIds: [7] },
      ),
    ).toBe(false);
  });
});

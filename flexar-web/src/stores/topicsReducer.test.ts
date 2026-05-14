// Unit tests for the topics reducers (`src/stores/topicsReducer`).
//
// Covers the canonical recency ordering and folding a `message` event
// into a loaded channel's topic list — inserting a new topic, bumping
// an existing topic's `max_id`, and leaving not-yet-loaded channels and
// non-channel messages untouched.

import { describe, expect, it } from "vitest";
import type { MessageEvent } from "../domain";
import {
  applyMessageEventToTopics,
  topicsByMaxIdDesc,
  type TopicsByChannel,
} from "./topicsReducer";
import { makeMessage } from "./testFixtures";

// A `message` event carrying a channel message in a given topic.
function channelMessageEvent(
  id: number,
  streamId: number,
  topic: string,
): MessageEvent {
  return {
    id: 1,
    type: "message",
    message: makeMessage({
      id,
      type: "stream",
      stream_id: streamId,
      subject: topic,
    }),
    flags: [],
  };
}

describe("topicsByMaxIdDesc", () => {
  it("orders topics most-recent-first by max_id", () => {
    expect(
      topicsByMaxIdDesc([
        { name: "a", max_id: 5 },
        { name: "b", max_id: 20 },
        { name: "c", max_id: 11 },
      ]),
    ).toEqual([
      { name: "b", max_id: 20 },
      { name: "c", max_id: 11 },
      { name: "a", max_id: 5 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { name: "a", max_id: 1 },
      { name: "b", max_id: 2 },
    ];
    topicsByMaxIdDesc(input);
    expect(input[0].name).toBe("a");
  });
});

describe("applyMessageEventToTopics", () => {
  it("inserts a new topic into a loaded channel and re-sorts", () => {
    const seeded: TopicsByChannel = {
      9: [{ name: "old", max_id: 10 }],
    };
    const next = applyMessageEventToTopics(
      seeded,
      channelMessageEvent(30, 9, "fresh"),
    );
    expect(next[9]).toEqual([
      { name: "fresh", max_id: 30 },
      { name: "old", max_id: 10 },
    ]);
  });

  it("bumps an existing topic's max_id and re-sorts it forward", () => {
    const seeded: TopicsByChannel = {
      9: [
        { name: "a", max_id: 40 },
        { name: "b", max_id: 20 },
      ],
    };
    const next = applyMessageEventToTopics(
      seeded,
      channelMessageEvent(50, 9, "b"),
    );
    expect(next[9]).toEqual([
      { name: "b", max_id: 50 },
      { name: "a", max_id: 40 },
    ]);
  });

  it("leaves a not-yet-loaded channel untouched", () => {
    const seeded: TopicsByChannel = {};
    expect(
      applyMessageEventToTopics(seeded, channelMessageEvent(1, 9, "t")),
    ).toBe(seeded);
  });

  it("ignores a direct message", () => {
    const seeded: TopicsByChannel = { 9: [{ name: "t", max_id: 1 }] };
    const event: MessageEvent = {
      id: 1,
      type: "message",
      message: makeMessage({ id: 5, type: "private" }),
      flags: [],
    };
    expect(applyMessageEventToTopics(seeded, event)).toBe(seeded);
  });

  it("is a no-op for an out-of-order message that does not advance max_id", () => {
    const seeded: TopicsByChannel = { 9: [{ name: "t", max_id: 100 }] };
    expect(
      applyMessageEventToTopics(seeded, channelMessageEvent(50, 9, "t")),
    ).toBe(seeded);
  });

  it("does not mutate the input map or its arrays", () => {
    const seeded: TopicsByChannel = { 9: [{ name: "t", max_id: 1 }] };
    applyMessageEventToTopics(seeded, channelMessageEvent(9, 9, "new"));
    expect(seeded[9]).toHaveLength(1);
  });
});

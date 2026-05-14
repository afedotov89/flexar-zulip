// Unit tests for the streams/subscriptions reducers
// (`src/stores/streamsReducer`).
//
// Covers hydration from the four register snapshot keys, and each
// `stream` and `subscription` event op — including the subscriber-count
// arithmetic of `peer_add` / `peer_remove` and the no-op edge cases the
// reducers must tolerate.

import { describe, expect, it } from "vitest";
import type { StreamEvent, SubscriptionEvent } from "../domain";
import {
  applyStreamEvent,
  applySubscriptionEvent,
  streamsFromInitialState,
  type StreamsSnapshot,
} from "./streamsReducer";
import {
  makeInitialState,
  makeStream,
  makeSubscription,
} from "./testFixtures";

describe("streamsFromInitialState", () => {
  it("populates streams from streams + never_subscribed + unsubscribed + subscriptions", () => {
    const snapshot = streamsFromInitialState(
      makeInitialState({
        streams: [makeStream({ stream_id: 1 })],
        never_subscribed: [makeStream({ stream_id: 2 })],
        unsubscribed: [makeSubscription({ stream_id: 3 })],
        subscriptions: [makeSubscription({ stream_id: 4 })],
      }),
    );
    expect(Object.keys(snapshot.streams).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("populates subscriptions only from the subscriptions key", () => {
    const snapshot = streamsFromInitialState(
      makeInitialState({
        streams: [makeStream({ stream_id: 1 })],
        unsubscribed: [makeSubscription({ stream_id: 3 })],
        subscriptions: [makeSubscription({ stream_id: 4 })],
      }),
    );
    expect(Object.keys(snapshot.subscriptions)).toEqual(["4"]);
  });

  it("returns empty maps when no channel keys are present", () => {
    expect(streamsFromInitialState(makeInitialState())).toEqual({
      streams: {},
      subscriptions: {},
    });
  });
});

describe("applyStreamEvent", () => {
  it("create adds the new channels", () => {
    const event: StreamEvent = {
      id: 1,
      type: "stream",
      op: "create",
      streams: [makeStream({ stream_id: 9, name: "new" })],
    };
    const next = applyStreamEvent({}, event);
    expect(next[9].name).toBe("new");
  });

  it("delete drops the channels", () => {
    const streams = { 9: makeStream({ stream_id: 9 }) };
    const next = applyStreamEvent(streams, {
      id: 1,
      type: "stream",
      op: "delete",
      streams: [makeStream({ stream_id: 9 })],
    });
    expect(9 in next).toBe(false);
  });

  it("delete of an unknown channel is a no-op", () => {
    const streams = { 9: makeStream({ stream_id: 9 }) };
    const next = applyStreamEvent(streams, {
      id: 1,
      type: "stream",
      op: "delete",
      streams: [makeStream({ stream_id: 404 })],
    });
    expect(next).toBe(streams);
  });

  it("update merges the changed property onto the channel", () => {
    const streams = { 9: makeStream({ stream_id: 9, name: "old" }) };
    const next = applyStreamEvent(streams, {
      id: 1,
      type: "stream",
      op: "update",
      stream_id: 9,
      name: "old",
      property: "description",
      value: "a new description",
    });
    expect(next[9].description).toBe("a new description");
    expect(next[9].name).toBe("old");
  });

  it("update of an unknown channel is a no-op", () => {
    const streams = { 9: makeStream({ stream_id: 9 }) };
    const next = applyStreamEvent(streams, {
      id: 1,
      type: "stream",
      op: "update",
      stream_id: 404,
      name: "ghost",
      property: "description",
      value: "x",
    });
    expect(next).toBe(streams);
  });

  it("does not mutate the input map", () => {
    const streams = { 9: makeStream({ stream_id: 9 }) };
    applyStreamEvent(streams, {
      id: 1,
      type: "stream",
      op: "delete",
      streams: [makeStream({ stream_id: 9 })],
    });
    expect(9 in streams).toBe(true);
  });
});

describe("applySubscriptionEvent — add / remove / update", () => {
  it("add inserts into subscriptions and refreshes streams metadata", () => {
    const snapshot: StreamsSnapshot = { streams: {}, subscriptions: {} };
    const event: SubscriptionEvent = {
      id: 1,
      type: "subscription",
      op: "add",
      subscriptions: [makeSubscription({ stream_id: 7, name: "joined" })],
    };
    const next = applySubscriptionEvent(snapshot, event);
    expect(next.subscriptions[7].name).toBe("joined");
    expect(next.streams[7].name).toBe("joined");
  });

  it("remove drops the subscription but keeps the channel in streams", () => {
    const snapshot: StreamsSnapshot = {
      streams: { 7: makeStream({ stream_id: 7 }) },
      subscriptions: { 7: makeSubscription({ stream_id: 7 }) },
    };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "remove",
      subscriptions: [{ stream_id: 7, name: "channel-7" }],
    });
    expect(7 in next.subscriptions).toBe(false);
    expect(7 in next.streams).toBe(true);
  });

  it("remove of a non-subscribed channel is a no-op", () => {
    const snapshot: StreamsSnapshot = {
      streams: { 7: makeStream({ stream_id: 7 }) },
      subscriptions: {},
    };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "remove",
      subscriptions: [{ stream_id: 7, name: "channel-7" }],
    });
    expect(next).toBe(snapshot);
  });

  it("update merges a personal property onto the subscription", () => {
    const snapshot: StreamsSnapshot = {
      streams: {},
      subscriptions: {
        7: makeSubscription({ stream_id: 7, color: "#000000" }),
      },
    };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "update",
      stream_id: 7,
      property: "color",
      value: "#ff0000",
    });
    expect(next.subscriptions[7].color).toBe("#ff0000");
  });

  it("update of an unknown subscription is a no-op", () => {
    const snapshot: StreamsSnapshot = { streams: {}, subscriptions: {} };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "update",
      stream_id: 7,
      property: "color",
      value: "#ff0000",
    });
    expect(next).toBe(snapshot);
  });
});

describe("applySubscriptionEvent — peer_add / peer_remove", () => {
  it("peer_add increments subscriber_count by the number of users", () => {
    const snapshot: StreamsSnapshot = {
      streams: { 7: makeStream({ stream_id: 7, subscriber_count: 10 }) },
      subscriptions: {
        7: makeSubscription({ stream_id: 7, subscriber_count: 10 }),
      },
    };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "peer_add",
      stream_ids: [7],
      user_ids: [101, 102],
    });
    expect(next.streams[7].subscriber_count).toBe(12);
    expect(next.subscriptions[7].subscriber_count).toBe(12);
  });

  it("peer_remove decrements subscriber_count and clamps at zero", () => {
    const snapshot: StreamsSnapshot = {
      streams: { 7: makeStream({ stream_id: 7, subscriber_count: 1 }) },
      subscriptions: {},
    };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "peer_remove",
      stream_ids: [7],
      user_ids: [101, 102, 103],
    });
    expect(next.streams[7].subscriber_count).toBe(0);
  });

  it("peer events for unknown channels are a no-op", () => {
    const snapshot: StreamsSnapshot = { streams: {}, subscriptions: {} };
    const next = applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "peer_add",
      stream_ids: [404],
      user_ids: [1],
    });
    expect(next).toBe(snapshot);
  });

  it("does not mutate the input snapshot", () => {
    const stream = makeStream({ stream_id: 7, subscriber_count: 10 });
    const snapshot: StreamsSnapshot = {
      streams: { 7: stream },
      subscriptions: {},
    };
    applySubscriptionEvent(snapshot, {
      id: 1,
      type: "subscription",
      op: "peer_add",
      stream_ids: [7],
      user_ids: [1],
    });
    expect(stream.subscriber_count).toBe(10);
  });
});

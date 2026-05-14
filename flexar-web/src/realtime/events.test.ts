// Unit tests for the pure event-stream helpers.

import { describe, expect, it } from "vitest";
import type { ServerEvent } from "../domain";
import { dropHeartbeats, isHeartbeat, maxEventId } from "./events";

/** A minimal heartbeat event. */
function heartbeat(id: number): ServerEvent {
  return { id, type: "heartbeat" };
}

/** A minimal non-heartbeat event (modelled loosely as UnknownEvent). */
function someEvent(id: number): ServerEvent {
  return { id, type: "presence" } as ServerEvent;
}

describe("maxEventId", () => {
  it("returns the current id for an empty batch", () => {
    expect(maxEventId([], 7)).toBe(7);
  });

  it("returns the highest id in the batch when it exceeds current", () => {
    expect(maxEventId([someEvent(8), someEvent(12), someEvent(9)], 7)).toBe(12);
  });

  it("never moves backwards below the current id", () => {
    // Stale/out-of-order batch must not rewind the cursor.
    expect(maxEventId([someEvent(3), someEvent(5)], 10)).toBe(10);
  });

  it("counts heartbeat ids toward the max", () => {
    expect(maxEventId([heartbeat(20)], 10)).toBe(20);
  });
});

describe("isHeartbeat", () => {
  it("is true only for heartbeat events", () => {
    expect(isHeartbeat(heartbeat(1))).toBe(true);
    expect(isHeartbeat(someEvent(1))).toBe(false);
  });
});

describe("dropHeartbeats", () => {
  it("removes heartbeat events and keeps the rest in order", () => {
    const batch = [
      someEvent(1),
      heartbeat(2),
      someEvent(3),
      heartbeat(4),
      someEvent(5),
    ];
    expect(dropHeartbeats(batch).map((e) => e.id)).toEqual([1, 3, 5]);
  });

  it("returns an empty array for an all-heartbeat batch", () => {
    expect(dropHeartbeats([heartbeat(1), heartbeat(2)])).toEqual([]);
  });

  it("returns all events when there are no heartbeats", () => {
    const batch = [someEvent(1), someEvent(2)];
    expect(dropHeartbeats(batch)).toEqual(batch);
  });
});

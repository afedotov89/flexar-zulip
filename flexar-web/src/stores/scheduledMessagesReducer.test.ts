// Unit tests for the scheduled-messages reducers.

import { describe, expect, it } from "vitest";
import type { ScheduledMessage } from "../domain";
import {
  applyAdd,
  applyRemove,
  applyUpdate,
  listScheduled,
  replaceAll,
  type ScheduledMessageMap,
} from "./scheduledMessagesReducer";

function fixture(overrides: Partial<ScheduledMessage>): ScheduledMessage {
  return {
    scheduled_message_id: 1,
    type: "stream",
    to: 11,
    topic: "release",
    content: "hello",
    rendered_content: "<p>hello</p>",
    scheduled_delivery_timestamp: 1000,
    failed: false,
    ...overrides,
  };
}

describe("replaceAll", () => {
  it("builds a fresh map keyed by scheduled_message_id", () => {
    const result = replaceAll([
      fixture({ scheduled_message_id: 1 }),
      fixture({ scheduled_message_id: 2, content: "again" }),
    ]);
    expect(Object.keys(result)).toEqual(["1", "2"]);
    expect(result[2]?.content).toBe("again");
  });

  it("returns an empty map for an empty input", () => {
    expect(replaceAll([])).toEqual({});
  });
});

describe("applyAdd", () => {
  it("inserts new entries", () => {
    const state: ScheduledMessageMap = {
      1: fixture({ scheduled_message_id: 1 }),
    };
    const result = applyAdd(state, [fixture({ scheduled_message_id: 2 })]);
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeDefined();
  });

  it("overwrites an entry that shares an id", () => {
    const state: ScheduledMessageMap = {
      1: fixture({ scheduled_message_id: 1, content: "old" }),
    };
    const result = applyAdd(state, [
      fixture({ scheduled_message_id: 1, content: "new" }),
    ]);
    expect(result[1]?.content).toBe("new");
  });

  it("returns the same reference for an empty add", () => {
    const state: ScheduledMessageMap = {};
    expect(applyAdd(state, [])).toBe(state);
  });
});

describe("applyUpdate", () => {
  it("replaces a known entry", () => {
    const state: ScheduledMessageMap = {
      1: fixture({ scheduled_message_id: 1, content: "old" }),
    };
    const result = applyUpdate(
      state,
      fixture({ scheduled_message_id: 1, content: "edited" }),
    );
    expect(result[1]?.content).toBe("edited");
  });

  it("ignores updates for unknown ids", () => {
    const state: ScheduledMessageMap = {};
    const updated = fixture({ scheduled_message_id: 99 });
    expect(applyUpdate(state, updated)).toBe(state);
  });
});

describe("applyRemove", () => {
  it("drops the matching entry", () => {
    const state: ScheduledMessageMap = {
      1: fixture({ scheduled_message_id: 1 }),
      2: fixture({ scheduled_message_id: 2 }),
    };
    const result = applyRemove(state, 1);
    expect(Object.keys(result)).toEqual(["2"]);
  });

  it("is a no-op for unknown ids", () => {
    const state: ScheduledMessageMap = {
      1: fixture({ scheduled_message_id: 1 }),
    };
    expect(applyRemove(state, 99)).toBe(state);
  });
});

describe("listScheduled", () => {
  it("sorts by delivery timestamp then by id", () => {
    const state = replaceAll([
      fixture({ scheduled_message_id: 3, scheduled_delivery_timestamp: 100 }),
      fixture({ scheduled_message_id: 1, scheduled_delivery_timestamp: 50 }),
      fixture({ scheduled_message_id: 2, scheduled_delivery_timestamp: 100 }),
    ]);
    const ids = listScheduled(state).map((m) => m.scheduled_message_id);
    expect(ids).toEqual([1, 2, 3]);
  });
});

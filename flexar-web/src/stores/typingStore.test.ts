// Unit tests for the typing store (Phase 4.3).

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TYPING_STALE_AFTER_MS,
  typingChannelKey,
  typingDmKey,
  useTypingStore,
} from "./typingStore";

beforeEach(() => {
  useTypingStore.setState({ buckets: {} });
});

afterEach(() => {
  useTypingStore.setState({ buckets: {} });
});

describe("typingDmKey", () => {
  it("sorts, de-duplicates, and prefixes with `dm:`", () => {
    expect(typingDmKey([100, 5, 100])).toBe("dm:5,100");
  });

  it("yields a single-id key for a self-DM", () => {
    expect(typingDmKey([5, 5])).toBe("dm:5");
  });
});

describe("typingChannelKey", () => {
  it("encodes streamId and topic with the `channel:` prefix", () => {
    expect(typingChannelKey(11, "release")).toBe("channel:11:release");
  });
});

describe("useTypingStore", () => {
  it("start() records a sender with their timestamp", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    expect(useTypingStore.getState().getSenders(key)).toEqual([7]);
  });

  it("multiple senders return sorted by user id", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    useTypingStore.getState().start(key, 3, 1100);
    useTypingStore.getState().start(key, 11, 1050);
    expect(useTypingStore.getState().getSenders(key)).toEqual([3, 7, 11]);
  });

  it("stop() removes only that sender, leaving others", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    useTypingStore.getState().start(key, 3, 1100);
    useTypingStore.getState().stop(key, 7);
    expect(useTypingStore.getState().getSenders(key)).toEqual([3]);
  });

  it("stop() prunes the bucket when no senders remain", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    useTypingStore.getState().stop(key, 7);
    expect(useTypingStore.getState().buckets[key]).toBeUndefined();
  });

  it("stop() is a no-op for an unknown sender", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    useTypingStore.getState().stop(key, 99);
    expect(useTypingStore.getState().getSenders(key)).toEqual([7]);
  });

  it("pruneStale evicts entries older than the staleness window", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 1000);
    useTypingStore.getState().start(key, 3, 5000);
    useTypingStore
      .getState()
      .pruneStale(1000 + TYPING_STALE_AFTER_MS + 1, TYPING_STALE_AFTER_MS);
    expect(useTypingStore.getState().getSenders(key)).toEqual([3]);
  });

  it("pruneStale leaves the buckets untouched when nothing changed", () => {
    const key = typingChannelKey(11, "release");
    useTypingStore.getState().start(key, 7, 5000);
    const before = useTypingStore.getState().buckets;
    useTypingStore.getState().pruneStale(6000);
    expect(useTypingStore.getState().buckets).toBe(before);
  });
});

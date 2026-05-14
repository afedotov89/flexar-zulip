// Unit tests for the presence-freshness helper (`./presence`).
//
// `presenceStatus` is a pure function of a `Presence` and a reference
// time, so the clock never needs mocking — the tests pass `now`
// explicitly.

import { describe, expect, it } from "vitest";
import {
  ACTIVE_THRESHOLD_SECONDS,
  IDLE_THRESHOLD_SECONDS,
  presenceStatus,
} from "./presence";

const NOW = 1_000_000;

describe("presenceStatus", () => {
  it("is offline when presence is undefined", () => {
    expect(presenceStatus(undefined, NOW)).toBe("offline");
  });

  it("is active for a recent active_timestamp", () => {
    expect(
      presenceStatus({ active_timestamp: NOW - 10 }, NOW),
    ).toBe("active");
  });

  it("is active right at the active threshold", () => {
    expect(
      presenceStatus(
        { active_timestamp: NOW - ACTIVE_THRESHOLD_SECONDS },
        NOW,
      ),
    ).toBe("active");
  });

  it("is idle for a stale active but recent idle_timestamp", () => {
    expect(
      presenceStatus(
        {
          active_timestamp: NOW - ACTIVE_THRESHOLD_SECONDS - 1,
          idle_timestamp: NOW - 10,
        },
        NOW,
      ),
    ).toBe("idle");
  });

  it("is idle right at the idle threshold", () => {
    expect(
      presenceStatus(
        { idle_timestamp: NOW - IDLE_THRESHOLD_SECONDS },
        NOW,
      ),
    ).toBe("idle");
  });

  it("is offline when both timestamps are stale", () => {
    expect(
      presenceStatus(
        {
          active_timestamp: NOW - ACTIVE_THRESHOLD_SECONDS - 1,
          idle_timestamp: NOW - IDLE_THRESHOLD_SECONDS - 1,
        },
        NOW,
      ),
    ).toBe("offline");
  });

  it("is offline for an empty presence object", () => {
    expect(presenceStatus({}, NOW)).toBe("offline");
  });
});

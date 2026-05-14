// Unit tests for the presence reducers (`src/stores/presenceReducer`).
//
// Covers hydration from the snapshot's `presences` key, and
// `applyPresenceEvent` handling both the modern (`presences`) and
// legacy (`user_id` + `presence`) event shapes.

import { describe, expect, it } from "vitest";
import type { PresenceEvent, PresenceMap } from "../domain";
import {
  applyPresenceEvent,
  presenceFromInitialState,
} from "./presenceReducer";
import { makeInitialState } from "./testFixtures";

describe("presenceFromInitialState", () => {
  it("projects the modern presences map off the snapshot", () => {
    const presences: PresenceMap = {
      1: { active_timestamp: 1000 },
      2: { idle_timestamp: 900 },
    };
    expect(
      presenceFromInitialState(makeInitialState({ presences })),
    ).toEqual(presences);
  });

  it("returns an empty map when presences is absent", () => {
    expect(presenceFromInitialState(makeInitialState())).toEqual({});
  });

  it("copies the snapshot map rather than aliasing it", () => {
    const presences: PresenceMap = { 1: { active_timestamp: 1000 } };
    const result = presenceFromInitialState(
      makeInitialState({ presences }),
    );
    expect(result).not.toBe(presences);
  });
});

describe("applyPresenceEvent — modern format", () => {
  it("merges the event's presences map into the state", () => {
    const state: PresenceMap = { 1: { active_timestamp: 1000 } };
    const event: PresenceEvent = {
      id: 1,
      type: "presence",
      presences: { 2: { active_timestamp: 2000 } },
    };
    const next = applyPresenceEvent(state, event);
    expect(next).toEqual({
      1: { active_timestamp: 1000 },
      2: { active_timestamp: 2000 },
    });
  });

  it("overwrites an existing user's presence", () => {
    const state: PresenceMap = { 1: { active_timestamp: 1000 } };
    const next = applyPresenceEvent(state, {
      id: 1,
      type: "presence",
      presences: { 1: { active_timestamp: 5000 } },
    });
    expect(next[1]).toEqual({ active_timestamp: 5000 });
  });

  it("does not mutate the input map", () => {
    const state: PresenceMap = { 1: { active_timestamp: 1000 } };
    applyPresenceEvent(state, {
      id: 1,
      type: "presence",
      presences: { 2: { active_timestamp: 2000 } },
    });
    expect(state).toEqual({ 1: { active_timestamp: 1000 } });
  });
});

describe("applyPresenceEvent — legacy format", () => {
  it("collapses per-client records into one Presence by newest timestamps", () => {
    const event: PresenceEvent = {
      id: 1,
      type: "presence",
      user_id: 3,
      server_timestamp: 9999,
      presence: {
        website: { active_timestamp: 1000, idle_timestamp: 800 },
        ZulipMobile: { active_timestamp: 1500, idle_timestamp: 1200 },
      },
    };
    const next = applyPresenceEvent({}, event);
    expect(next[3]).toEqual({
      active_timestamp: 1500,
      idle_timestamp: 1200,
    });
  });

  it("yields an empty Presence when no client record has a timestamp", () => {
    const next = applyPresenceEvent(
      {},
      {
        id: 1,
        type: "presence",
        user_id: 3,
        presence: { website: {} },
      },
    );
    expect(next[3]).toEqual({});
  });
});

describe("applyPresenceEvent — malformed", () => {
  it("is a no-op when the event carries neither shape", () => {
    const state: PresenceMap = { 1: { active_timestamp: 1000 } };
    const next = applyPresenceEvent(state, { id: 1, type: "presence" });
    expect(next).toBe(state);
  });
});

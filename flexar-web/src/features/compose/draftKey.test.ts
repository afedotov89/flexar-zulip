// Unit tests for the draft key/destination derivation
// (`src/features/compose/draftKey`).
//
// `draftKeyFor` is the single point that decides whether a compose
// state is "addressed enough" to autosave. The `null` cases below are
// the contract the autosave wiring relies on.

import { describe, expect, it } from "vitest";
import { destinationFor, draftKeyFor } from "./draftKey";

describe("draftKeyFor", () => {
  it("returns null for the unaddressed (none) compose state", () => {
    expect(draftKeyFor({ mode: "none" })).toBeNull();
  });

  it("returns null for a channel pre-fill missing its stream id", () => {
    expect(
      draftKeyFor({ mode: "channel", streamId: undefined, topic: "t" }),
    ).toBeNull();
  });

  it("returns null for a DM pre-fill with no recipients", () => {
    expect(draftKeyFor({ mode: "direct", recipientIds: [] })).toBeNull();
  });

  it("builds a channel key from streamId + topic", () => {
    expect(
      draftKeyFor({ mode: "channel", streamId: 7, topic: "deploys" }),
    ).toBe("channel:7:deploys");
  });

  it("builds a channel key with an empty topic when none is set", () => {
    expect(draftKeyFor({ mode: "channel", streamId: 7, topic: "" })).toBe(
      "channel:7:",
    );
  });

  it("builds a DM key from sorted recipient ids", () => {
    expect(draftKeyFor({ mode: "direct", recipientIds: [9, 2, 5] })).toBe(
      "dm:2,5,9",
    );
  });

  it("yields the same key regardless of recipient input order", () => {
    expect(draftKeyFor({ mode: "direct", recipientIds: [2, 5, 9] })).toBe(
      draftKeyFor({ mode: "direct", recipientIds: [9, 5, 2] }),
    );
  });
});

describe("destinationFor", () => {
  it("returns null for the unaddressed (none) compose state", () => {
    expect(destinationFor({ mode: "none" })).toBeNull();
  });

  it("returns null for a channel pre-fill missing its stream id", () => {
    expect(
      destinationFor({ mode: "channel", streamId: undefined, topic: "t" }),
    ).toBeNull();
  });

  it("returns null for a DM pre-fill with no recipients", () => {
    expect(destinationFor({ mode: "direct", recipientIds: [] })).toBeNull();
  });

  it("returns a channel destination", () => {
    expect(
      destinationFor({ mode: "channel", streamId: 7, topic: "deploys" }),
    ).toEqual({ type: "channel", streamId: 7, topic: "deploys" });
  });

  it("returns a DM destination with sorted recipient ids", () => {
    expect(
      destinationFor({ mode: "direct", recipientIds: [9, 2, 5] }),
    ).toEqual({ type: "direct", recipientIds: [2, 5, 9] });
  });
});

// Unit tests for `composeFromNarrow`: the pure mapping from
// "URL narrow" to "compose box pre-fill".

import { describe, expect, it } from "vitest";
import type { Narrow } from "../../domain";
import { composeFromNarrow } from "./composeFromNarrow";

describe("composeFromNarrow", () => {
  it("returns mode 'none' when there is no narrow (special view / login)", () => {
    expect(composeFromNarrow(undefined, 1)).toEqual({ mode: "none" });
  });

  it("returns mode 'none' for the empty narrow (Combined feed)", () => {
    expect(composeFromNarrow([], 1)).toEqual({ mode: "none" });
  });

  it("pre-fills channel + topic from a channel+topic narrow", () => {
    const narrow: Narrow = [
      { operator: "channel", operand: 7 },
      { operator: "topic", operand: "deploys" },
    ];
    expect(composeFromNarrow(narrow, 1)).toEqual({
      mode: "channel",
      streamId: 7,
      topic: "deploys",
    });
  });

  it("pre-fills channel only when the narrow has no topic", () => {
    const narrow: Narrow = [{ operator: "channel", operand: 7 }];
    expect(composeFromNarrow(narrow, 1)).toEqual({
      mode: "channel",
      streamId: 7,
      topic: "",
    });
  });

  it("accepts the legacy `stream` operator as channel", () => {
    const narrow: Narrow = [{ operator: "stream", operand: 7 }];
    expect(composeFromNarrow(narrow, 1)).toMatchObject({
      mode: "channel",
      streamId: 7,
    });
  });

  it("ignores negated channel terms", () => {
    const narrow: Narrow = [
      { operator: "channel", operand: 7, negated: true },
    ];
    expect(composeFromNarrow(narrow, 1)).toEqual({ mode: "none" });
  });

  it("accepts a numeric-string channel operand defensively", () => {
    const narrow: Narrow = [{ operator: "channel", operand: "7" }];
    expect(composeFromNarrow(narrow, 1)).toMatchObject({
      mode: "channel",
      streamId: 7,
    });
  });

  it("derives DM recipients from a `dm` narrow, stripping the viewer", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [1, 2, 3] }];
    expect(composeFromNarrow(narrow, 1)).toEqual({
      mode: "direct",
      recipientIds: [2, 3],
    });
  });

  it("accepts the legacy `pm-with` operator as DM", () => {
    const narrow: Narrow = [{ operator: "pm-with", operand: [1, 5] }];
    expect(composeFromNarrow(narrow, 1)).toEqual({
      mode: "direct",
      recipientIds: [5],
    });
  });

  it("falls back to the raw participant list for a self-only DM", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [1] }];
    expect(composeFromNarrow(narrow, 1)).toEqual({
      mode: "direct",
      recipientIds: [1],
    });
  });

  it("returns mode 'none' for a search-only narrow", () => {
    const narrow: Narrow = [{ operator: "search", operand: "hello" }];
    expect(composeFromNarrow(narrow, 1)).toEqual({ mode: "none" });
  });

  it("returns mode 'none' for an `is:` built-in narrow (e.g. starred)", () => {
    const narrow: Narrow = [{ operator: "is", operand: "starred" }];
    expect(composeFromNarrow(narrow, 1)).toEqual({ mode: "none" });
  });

  it("does not strip recipients when the viewer id is unknown", () => {
    const narrow: Narrow = [{ operator: "dm", operand: [2, 3] }];
    expect(composeFromNarrow(narrow, undefined)).toEqual({
      mode: "direct",
      recipientIds: [2, 3],
    });
  });
});

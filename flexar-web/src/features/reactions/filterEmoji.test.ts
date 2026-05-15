// Unit tests for `filterEmoji`.

import { describe, expect, it } from "vitest";
import { EMOJI_CORPUS } from "../../lib/emoji";
import { filterEmoji } from "./filterEmoji";

describe("filterEmoji", () => {
  it("returns the whole corpus for an empty query", () => {
    expect(filterEmoji("")).toBe(EMOJI_CORPUS);
  });

  it("returns the whole corpus for a whitespace-only query", () => {
    expect(filterEmoji("   ")).toBe(EMOJI_CORPUS);
  });

  it("filters by substring on shortcode (case-insensitive)", () => {
    const result = filterEmoji("THUMBS");
    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.shortcode).toMatch(/thumbs/);
    }
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterEmoji("zzz_no_such_emoji_zzz")).toHaveLength(0);
  });

  it("preserves corpus order in the filtered result", () => {
    const result = filterEmoji("a");
    const indices = result.map((entry) =>
      EMOJI_CORPUS.findIndex((e) => e.shortcode === entry.shortcode),
    );
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});

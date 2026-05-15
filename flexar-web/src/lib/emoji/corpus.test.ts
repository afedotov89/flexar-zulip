// Tests for the bundled emoji corpus.
//
// The corpus is data, not logic; the only invariants worth asserting
// are: (a) it has at least the documented "small starter set" size,
// (b) shortcodes are unique (else two rows would render with the same
// label), (c) every entry has a non-empty glyph (the typeahead row would
// look broken otherwise).

import { describe, it, expect } from "vitest";
import { EMOJI_CORPUS } from "./corpus";

describe("EMOJI_CORPUS", () => {
  it("contains a meaningful starter set (~80-150 entries)", () => {
    expect(EMOJI_CORPUS.length).toBeGreaterThanOrEqual(80);
    expect(EMOJI_CORPUS.length).toBeLessThanOrEqual(160);
  });

  it("has unique shortcodes", () => {
    const seen = new Set<string>();
    for (const entry of EMOJI_CORPUS) {
      expect(seen.has(entry.shortcode), `duplicate ${entry.shortcode}`).toBe(
        false,
      );
      seen.add(entry.shortcode);
    }
  });

  it("has a non-empty glyph and shortcode for every entry", () => {
    for (const entry of EMOJI_CORPUS) {
      expect(entry.shortcode.length).toBeGreaterThan(0);
      expect(entry.glyph.length).toBeGreaterThan(0);
    }
  });

  it("uses safe shortcode characters (lowercase letters, digits, underscore)", () => {
    // Zulip emoji shortcode convention; matters because we splice
    // `:${shortcode}:` into a Markdown body and the server parses it.
    const safe = /^[a-z0-9_]+$/;
    for (const entry of EMOJI_CORPUS) {
      expect(safe.test(entry.shortcode), entry.shortcode).toBe(true);
    }
  });

  it("includes the popular reaction emoji users expect by default", () => {
    // A small smoke check that the curated set is actually useful.
    const codes = new Set(EMOJI_CORPUS.map((e) => e.shortcode));
    for (const expected of [
      "smile",
      "heart",
      "thumbs_up",
      "wave",
      "rocket",
      "fire",
      "eyes",
      "clap",
      "tada",
      "check",
    ]) {
      expect(codes.has(expected), `missing ${expected}`).toBe(true);
    }
  });
});

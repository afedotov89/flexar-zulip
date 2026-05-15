// Unit tests for the emoji-identity helpers (Phase 3.2).

import { describe, expect, it } from "vitest";
import { EMOJI_CORPUS } from "./corpus";
import {
  corpusEntryByName,
  emojiCodeFromGlyph,
  glyphFromUnicodeEmojiCode,
  identityFromCorpusEntry,
  reactionDisplayGlyph,
} from "./identity";

describe("emojiCodeFromGlyph", () => {
  it("encodes a single-codepoint emoji as one hex token", () => {
    expect(emojiCodeFromGlyph("👍")).toBe("1f44d");
    expect(emojiCodeFromGlyph("🔥")).toBe("1f525");
  });

  it("encodes a multi-codepoint emoji with dash separators", () => {
    // ❤️ is U+2764 + U+FE0F (text-style + variation selector).
    expect(emojiCodeFromGlyph("❤️")).toBe("2764-fe0f");
  });

  it("returns the empty string for an empty input", () => {
    expect(emojiCodeFromGlyph("")).toBe("");
  });
});

describe("glyphFromUnicodeEmojiCode", () => {
  it("decodes a single-codepoint emoji_code", () => {
    expect(glyphFromUnicodeEmojiCode("1f44d")).toBe("👍");
  });

  it("decodes a multi-codepoint emoji_code", () => {
    expect(glyphFromUnicodeEmojiCode("2764-fe0f")).toBe("❤️");
  });

  it("returns null for an empty code", () => {
    expect(glyphFromUnicodeEmojiCode("")).toBeNull();
  });

  it("returns null for non-hex input", () => {
    expect(glyphFromUnicodeEmojiCode("xyz")).toBeNull();
    expect(glyphFromUnicodeEmojiCode("1f44d-zz")).toBeNull();
  });

  it("returns null for an out-of-range codepoint", () => {
    expect(glyphFromUnicodeEmojiCode("110000")).toBeNull();
  });
});

describe("reactionDisplayGlyph", () => {
  it("returns the decoded glyph for a unicode_emoji reaction", () => {
    expect(
      reactionDisplayGlyph({
        emoji_name: "thumbs_up",
        emoji_code: "1f44d",
        reaction_type: "unicode_emoji",
      }),
    ).toBe("👍");
  });

  it("falls back to :name: for realm_emoji", () => {
    expect(
      reactionDisplayGlyph({
        emoji_name: "octocat",
        emoji_code: "12345",
        reaction_type: "realm_emoji",
      }),
    ).toBe(":octocat:");
  });

  it("falls back to :name: for zulip_extra_emoji", () => {
    expect(
      reactionDisplayGlyph({
        emoji_name: "zulip",
        emoji_code: "zulip",
        reaction_type: "zulip_extra_emoji",
      }),
    ).toBe(":zulip:");
  });

  it("falls back to :name: when a unicode emoji_code is malformed", () => {
    expect(
      reactionDisplayGlyph({
        emoji_name: "broken",
        emoji_code: "not-hex",
        reaction_type: "unicode_emoji",
      }),
    ).toBe(":broken:");
  });
});

describe("identityFromCorpusEntry", () => {
  it("builds a unicode_emoji triple with the encoded glyph as emoji_code", () => {
    const identity = identityFromCorpusEntry({
      shortcode: "thumbs_up",
      glyph: "👍",
    });
    expect(identity).toEqual({
      emoji_name: "thumbs_up",
      emoji_code: "1f44d",
      reaction_type: "unicode_emoji",
    });
  });
});

describe("corpusEntryByName", () => {
  it("finds an existing shortcode", () => {
    const entry = corpusEntryByName("thumbs_up");
    expect(entry?.glyph).toBe("👍");
  });

  it("returns undefined for an unknown shortcode", () => {
    expect(corpusEntryByName("__never__")).toBeUndefined();
  });

  it("every corpus entry produces a non-empty emoji_code", () => {
    for (const entry of EMOJI_CORPUS) {
      const identity = identityFromCorpusEntry(entry);
      expect(identity.emoji_code.length).toBeGreaterThan(0);
    }
  });
});

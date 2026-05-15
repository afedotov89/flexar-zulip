// Tests for the typeahead trigger detector.
//
// `|` in the test names marks the simulated cursor position; in the
// actual input strings the cursor is given as the integer offset.

import { describe, it, expect } from "vitest";
import { detectTrigger } from "./triggerDetect";

describe("detectTrigger — opens correctly", () => {
  it("opens a mention typeahead at the start of the string", () => {
    expect(detectTrigger("@", 1)).toEqual({
      kind: "mention",
      query: "",
      start: 0,
      end: 1,
    });
  });

  it("opens with a partial query", () => {
    expect(detectTrigger("@al", 3)).toEqual({
      kind: "mention",
      query: "al",
      start: 0,
      end: 3,
    });
  });

  it("opens after a leading space", () => {
    // "hi @al"
    expect(detectTrigger("hi @al", 6)).toEqual({
      kind: "mention",
      query: "al",
      start: 3,
      end: 6,
    });
  });

  it("opens after a newline", () => {
    expect(detectTrigger("hi\n@al", 6)).toEqual({
      kind: "mention",
      query: "al",
      start: 3,
      end: 6,
    });
  });

  it("opens after a phrase punctuation `(`", () => {
    expect(detectTrigger("(@al", 4)).toEqual({
      kind: "mention",
      query: "al",
      start: 1,
      end: 4,
    });
  });

  it("opens a channel typeahead", () => {
    expect(detectTrigger("see #en", 7)).toEqual({
      kind: "channel",
      query: "en",
      start: 4,
      end: 7,
    });
  });

  it("opens an emoji typeahead", () => {
    expect(detectTrigger(":sm", 3)).toEqual({
      kind: "emoji",
      query: "sm",
      start: 0,
      end: 3,
    });
  });

  it("allows inner spaces in name queries", () => {
    // `@John D` should still match — full names contain spaces.
    expect(detectTrigger("@John D", 7)).toEqual({
      kind: "mention",
      query: "John D",
      start: 0,
      end: 7,
    });
  });

  it("uses the last trigger when multiple are present", () => {
    // `@al @bo|` — the open token is `@bo`, not `@al @bo`.
    const value = "@al @bo";
    expect(detectTrigger(value, value.length)).toEqual({
      kind: "mention",
      query: "bo",
      start: 4,
      end: 7,
    });
  });

  it("opens after a comma boundary", () => {
    expect(detectTrigger("hi,@al", 6)).toEqual({
      kind: "mention",
      query: "al",
      start: 3,
      end: 6,
    });
  });
});

describe("detectTrigger — does not open", () => {
  it("does not open in the middle of an email address", () => {
    expect(detectTrigger("alice@host", 10)).toBeNull();
  });

  it("does not open in the middle of `prefix#tag`", () => {
    expect(detectTrigger("issue#42", 8)).toBeNull();
  });

  it("does not open in `time:00:30`", () => {
    expect(detectTrigger("time:00:30", 10)).toBeNull();
  });

  it("does not open inside a URL like https://example", () => {
    // `:` inside `https://` follows a letter, not a boundary.
    expect(detectTrigger("https://example", 8)).toBeNull();
  });

  it("does not open immediately after typing a trailing space", () => {
    // `@al |`
    expect(detectTrigger("@al ", 4)).toBeNull();
  });

  it("does not open for the empty string / cursor at 0", () => {
    expect(detectTrigger("", 0)).toBeNull();
    expect(detectTrigger("hello", 0)).toBeNull();
  });

  it("does not open when the emoji query contains a space", () => {
    // The emoji shortcode space is `[a-z0-9_]+`, no spaces — so as
    // soon as a space appears in a `:`-token query it's not an emoji
    // typeahead any more.
    expect(detectTrigger(":sm ile", 7)).toBeNull();
  });

  it("does not open across a newline boundary", () => {
    expect(detectTrigger("@al\nfoo", 7)).toBeNull();
  });

  it("returns null for out-of-range cursor positions", () => {
    expect(detectTrigger("hi", -1)).toBeNull();
    expect(detectTrigger("hi", 10)).toBeNull();
  });
});

describe("detectTrigger — slice math is consistent", () => {
  it("`start..end` selects exactly the trigger + query", () => {
    const value = "hello @ali";
    const trigger = detectTrigger(value, value.length);
    expect(trigger).not.toBeNull();
    expect(value.slice(trigger!.start, trigger!.end)).toBe("@ali");
  });

  it("end equals the cursor", () => {
    const value = "hello @ali ce";
    // Cursor placed after `e` of `ce`.
    const cursor = 13;
    const trigger = detectTrigger(value, cursor);
    expect(trigger).toEqual({
      kind: "mention",
      query: "ali ce",
      start: 6,
      end: cursor,
    });
  });
});

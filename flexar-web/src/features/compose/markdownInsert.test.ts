// Unit tests for the compose-toolbar Markdown insert helpers. Pure
// string→string functions; the tests pin both the resulting value and
// the new selection range (essential for typing UX — the caret has to
// land in the right place every time).

import { describe, expect, it } from "vitest";
import {
  insertCodeBlock,
  insertLink,
  insertNumberedList,
  prefixLines,
  wrapSelection,
} from "./markdownInsert";

describe("wrapSelection", () => {
  it("wraps a non-empty selection and keeps the inner text selected", () => {
    const result = wrapSelection("Hello world", { start: 6, end: 11 }, "**");
    expect(result.value).toBe("Hello **world**");
    // Inner "world" stays selected (offset by the prefix length).
    expect(result.selection).toEqual({ start: 8, end: 13 });
  });

  it("inserts the pair and places the caret between when nothing is selected", () => {
    const result = wrapSelection("Hi ", { start: 3, end: 3 }, "*");
    expect(result.value).toBe("Hi **");
    expect(result.selection).toEqual({ start: 4, end: 4 });
  });

  it("supports an asymmetric pair (prefix/suffix differ)", () => {
    const result = wrapSelection(
      "abc",
      { start: 0, end: 3 },
      "[[",
      "]]",
    );
    expect(result.value).toBe("[[abc]]");
    expect(result.selection).toEqual({ start: 2, end: 5 });
  });

  it("wraps an empty value (degenerate but valid)", () => {
    const result = wrapSelection("", { start: 0, end: 0 }, "~~");
    expect(result.value).toBe("~~~~");
    expect(result.selection).toEqual({ start: 2, end: 2 });
  });
});

describe("insertLink", () => {
  it("uses the selection as the link text and parks the caret in the URL", () => {
    const result = insertLink("see Flexar docs", { start: 4, end: 10 });
    // Selected was "Flexar"; placeholder URL is empty so the caret
    // lands right after `(`.
    expect(result.value).toBe("see [Flexar]() docs");
    expect(result.selection).toEqual({ start: 13, end: 13 });
  });

  it("inserts a placeholder text and selects it when no selection", () => {
    const result = insertLink("see ", { start: 4, end: 4 });
    expect(result.value).toBe("see [текст]()");
    // Placeholder "текст" is selected so the user can overwrite it.
    expect(result.selection).toEqual({ start: 5, end: 10 });
  });

  it("uses a supplied URL", () => {
    const result = insertLink(
      "see ",
      { start: 4, end: 4 },
      "https://example.com",
    );
    expect(result.value).toBe("see [текст](https://example.com)");
  });
});

describe("prefixLines", () => {
  it("prefixes every line in a multi-line selection", () => {
    const value = "one\ntwo\nthree";
    const result = prefixLines(value, { start: 0, end: value.length }, "> ");
    expect(result.value).toBe("> one\n> two\n> three");
  });

  it("prefixes only the line under the caret when selection is collapsed", () => {
    const value = "one\ntwo\nthree";
    // Caret in "two".
    const result = prefixLines(value, { start: 6, end: 6 }, "- ");
    expect(result.value).toBe("one\n- two\nthree");
  });

  it("includes lines partially covered by the selection", () => {
    const value = "alpha\nbeta\ngamma";
    // Selection spans last char of "alpha" and first char of "beta".
    const result = prefixLines(value, { start: 4, end: 7 }, "> ");
    expect(result.value).toBe("> alpha\n> beta\ngamma");
  });

  it("does not eat the trailing line when the selection ends on a newline", () => {
    const value = "first\nsecond\nthird";
    // Selection is the whole "first\n".
    const result = prefixLines(value, { start: 0, end: 6 }, "> ");
    expect(result.value).toBe("> first\nsecond\nthird");
  });
});

describe("insertNumberedList", () => {
  it("numbers each line sequentially starting at 1", () => {
    const value = "apple\nbanana\ncherry";
    const result = insertNumberedList(value, {
      start: 0,
      end: value.length,
    });
    expect(result.value).toBe("1. apple\n2. banana\n3. cherry");
  });

  it("renumbers when invoked on a smaller subrange", () => {
    const value = "apple\nbanana\ncherry";
    // Just "banana".
    const result = insertNumberedList(value, { start: 6, end: 12 });
    expect(result.value).toBe("apple\n1. banana\ncherry");
  });
});

describe("insertCodeBlock", () => {
  it("fences a non-empty selection on its own lines", () => {
    const value = "Hello\nworld\nbye";
    const result = insertCodeBlock(value, { start: 6, end: 11 });
    // "world" goes inside ```; padded with blank line on the trailing
    // side because there's still text after.
    expect(result.value).toContain("```\nworld\n```");
    // The new selection covers "world" inside the fences.
    expect(
      result.value.slice(result.selection.start, result.selection.end),
    ).toBe("world");
  });

  it("inserts empty fences with the caret between them when nothing selected", () => {
    const result = insertCodeBlock("", { start: 0, end: 0 });
    expect(result.value).toBe("```\n\n```");
    // Caret on the empty line between the fences.
    expect(result.selection).toEqual({ start: 4, end: 4 });
  });

  it("doesn't double up newlines when there's already blank padding", () => {
    const value = "intro\n\n";
    const result = insertCodeBlock(value, {
      start: value.length,
      end: value.length,
    });
    // Already has "\n\n" before — no extra padding.
    expect(result.value).toBe("intro\n\n```\n\n```");
  });
});

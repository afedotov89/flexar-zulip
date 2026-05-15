// Unit tests for the unicode-emoji decorator.

import { describe, expect, it } from "vitest";
import { decorateEmojis } from "./emoji";

function build(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("decorateEmojis", () => {
  it("replaces the shortcode text with the unicode glyph for a single-codepoint emoji", () => {
    const root = build(
      '<span class="emoji emoji-1f449" role="img" aria-label="point right">:point_right:</span>',
    );
    decorateEmojis(root);
    expect(root.querySelector("span.emoji")?.textContent).toBe("\u{1f449}");
  });

  it("assembles dash-joined hex codepoints (flag / ZWJ sequence)", () => {
    // Russia flag: U+1F1F7 U+1F1FA
    const root = build(
      '<span class="emoji emoji-1f1f7-1f1fa" role="img" aria-label="ru">:ru:</span>',
    );
    decorateEmojis(root);
    expect(root.querySelector("span.emoji")?.textContent).toBe(
      "\u{1f1f7}\u{1f1fa}",
    );
  });

  it("is idempotent — a second pass does not double-decorate", () => {
    const root = build(
      '<span class="emoji emoji-1f44b" role="img">:wave:</span>',
    );
    decorateEmojis(root);
    decorateEmojis(root);
    const span = root.querySelector("span.emoji");
    expect(span?.textContent).toBe("\u{1f44b}");
    expect(span?.getAttribute("data-emoji-decorated")).toBe("true");
  });

  it("leaves non-unicode emoji spans (no `emoji-{hex}` class) untouched", () => {
    const root = build(
      '<span class="emoji emoji-zulip" role="img">:zulip:</span>',
    );
    decorateEmojis(root);
    expect(root.querySelector("span.emoji")?.textContent).toBe(":zulip:");
  });

  it("leaves a malformed codepoint class untouched (text fallback survives)", () => {
    const root = build(
      '<span class="emoji emoji-zzz" role="img">:weird:</span>',
    );
    decorateEmojis(root);
    expect(root.querySelector("span.emoji")?.textContent).toBe(":weird:");
  });

  it("does not touch custom emoji `<img class=\"emoji\">` elements", () => {
    const root = build(
      '<img class="emoji emoji-realm-7" src="/static/emoji/7.png" alt=":party:">',
    );
    decorateEmojis(root);
    const img = root.querySelector("img.emoji");
    expect(img?.getAttribute("alt")).toBe(":party:");
    expect(img?.getAttribute("src")).toBe("/static/emoji/7.png");
  });

  it("decorates many emojis in one pass", () => {
    const root = build(
      [
        '<span class="emoji emoji-1f449">:point_right:</span>',
        " ",
        '<span class="emoji emoji-1f44b">:wave:</span>',
        " ",
        '<span class="emoji emoji-2705">:white_check_mark:</span>',
      ].join(""),
    );
    decorateEmojis(root);
    const texts = [...root.querySelectorAll("span.emoji")].map(
      (s) => s.textContent,
    );
    expect(texts).toEqual(["\u{1f449}", "\u{1f44b}", "\u{2705}"]);
  });
});

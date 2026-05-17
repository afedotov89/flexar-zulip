// Pure helper: turn a chunk of Zulip-rendered message HTML into a
// plain-text snippet suitable for previews (Recent rows, notifications,
// quote-blocks of replies, …).
//
// Naively stripping tags with a regex breaks on emoji: Zulip's
// rendered_content carries unicode emoji as
// `<span class="emoji emoji-XXXX">:shortcode:</span>` where the inner
// text is the colon shortcode (`:point_right:`), not the glyph. The
// glyph lives in the class. Stripping tags leaves the shortcode in
// the snippet, which is what a previous regex-only pass produced.
//
// Architecturally we want the same emoji decode the message-DOM
// decorator uses. Use DOMParser to lift the HTML into a real DOM,
// rewrite the emoji elements just like `decorateEmojis` does, then
// take `textContent` and normalise whitespace. One source of truth
// for the codec (`unicodeFromEmojiClasses`), browser-grade entity
// handling, and no fragile tag-stripping regex.

import { unicodeFromEmojiClasses } from "./emojiCodepoint";

// `DOMParser` is provided by every browser environment we target,
// but some Node test runners load the module before jsdom installs
// it on the global. Instantiating at module-load throws in that
// window; the lazy-init keeps it a one-shot allocation in browsers
// while postponing the lookup until the first call.
let parser: DOMParser | null = null;
function getParser(): DOMParser {
  parser ??= new DOMParser();
  return parser;
}

export interface HtmlToPlainTextOptions {
  /**
   * Hard cap on the returned string length. The result is truncated
   * mid-character with a trailing `…` when it would exceed this.
   * Default: no limit (return the full snippet).
   */
  maxLength?: number;
}

export function htmlToPlainText(
  html: string,
  options: HtmlToPlainTextOptions = {},
): string {
  if (html === "") {
    return "";
  }
  const doc = getParser().parseFromString(
    `<body>${html}</body>`,
    "text/html",
  );

  // Unicode emoji spans: replace inner text with the actual glyph.
  // The shortcode (`:point_right:`) is the inner text Zulip emits as a
  // fallback for when CSS / decoration didn't run.
  for (const span of doc.querySelectorAll<HTMLSpanElement>("span.emoji")) {
    const glyph = unicodeFromEmojiClasses(span.classList);
    if (glyph !== null) {
      span.textContent = glyph;
    }
  }

  // Custom realm emoji are `<img class="emoji" alt=":name:">`. textContent
  // on an <img> is empty, so without this they vanish from the snippet.
  // The alt attribute carries the colon-shortcode the user typed —
  // a reasonable text representation for a one-line preview.
  for (const img of doc.querySelectorAll<HTMLImageElement>("img.emoji")) {
    const alt = img.getAttribute("alt") ?? "";
    img.replaceWith(doc.createTextNode(alt));
  }

  // Block-level elements should produce a space at their boundary
  // (otherwise "<p>foo</p><p>bar</p>" textContent gives "foobar").
  // Cheap version: walk a small list of common block tags and append a
  // space text node; we don't need DOM perfection for a snippet.
  for (const block of doc.querySelectorAll(
    "p, br, li, blockquote, pre, h1, h2, h3, h4, h5, h6, tr, div",
  )) {
    block.appendChild(doc.createTextNode(" "));
  }

  const raw = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  const max = options.maxLength;
  if (max === undefined || raw.length <= max) {
    return raw;
  }
  return raw.slice(0, max - 1) + "…";
}

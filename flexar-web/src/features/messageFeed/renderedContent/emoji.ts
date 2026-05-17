// Flexar Hub Web — Unicode-emoji rendering for rendered message content.
//
// Zulip's renderer emits a unicode emoji as:
//
//   <span aria-label="point right" class="emoji emoji-1f449"
//         role="img" title="point right">:point_right:</span>
//
// The inner text is the colon-shortcode fallback — without further
// work the user just sees `:point_right:`. This module's job is the
// DOM-side rewrite: walk the message-content tree once after sanitise,
// replace each span's text with the actual unicode glyph, mark each
// touched span so a re-run after a re-render skips work it's already
// done. The codec itself (class → glyph) lives in
// `lib/renderedContent/emojiCodepoint.ts` so the same logic powers
// snippet-text extraction (Recent rows, …) without re-implementing.
//
// Custom realm emoji (`<img class="emoji emoji-{id}" src="…">`) are
// already images and are not touched here.

import { unicodeFromEmojiClasses } from "../../../lib/renderedContent";

const EMOJI_CLASS = "emoji";
const DECORATED_FLAG = "data-emoji-decorated";

/**
 * Replace the colon-shortcode text inside every unicode-emoji `<span>`
 * with the actual unicode character(s) derived from its class. Custom
 * realm emoji (which are `<img>` elements) are skipped — they render
 * as images already. Idempotent: spans already decorated are skipped.
 */
export function decorateEmojis(container: HTMLElement): void {
  const spans = container.querySelectorAll<HTMLSpanElement>(
    `span.${EMOJI_CLASS}`,
  );
  for (const span of spans) {
    if (span.getAttribute(DECORATED_FLAG) === "true") {
      continue;
    }
    const glyph = unicodeFromEmojiClasses(span.classList);
    if (glyph !== null) {
      span.textContent = glyph;
    }
    span.setAttribute(DECORATED_FLAG, "true");
  }
}

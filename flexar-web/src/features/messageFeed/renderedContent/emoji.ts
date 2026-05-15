// Flexar Hub Web — Unicode-emoji rendering for rendered message content.
//
// Zulip's renderer emits a unicode emoji as:
//
//   <span aria-label="point right" class="emoji emoji-1f449"
//         role="img" title="point right">:point_right:</span>
//
// The codepoint(s) are encoded in the `emoji-…` class as dash-joined
// hex (e.g. `emoji-1f1f7-1f1fa` for the Russia flag); the inner text
// is the colon-shortcode fallback (`:point_right:`). Without further
// work the user just sees the shortcode text. This module replaces
// each span's text with the actual unicode glyph derived from the
// class, so the OS / web font renders the emoji visually.
//
// Custom realm emoji (`<img class="emoji emoji-{id}" src="…">`) are
// already images and are not touched here.

const EMOJI_CLASS = "emoji";
const EMOJI_CODEPOINT_PREFIX = "emoji-";
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
    const glyph = unicodeFromClasses(span.classList);
    if (glyph !== null) {
      span.textContent = glyph;
    }
    span.setAttribute(DECORATED_FLAG, "true");
  }
}

/**
 * Pull the codepoint(s) out of the `emoji-…` class and return the
 * corresponding unicode string, or `null` if the class is missing or
 * unparseable. Multi-codepoint emoji (flags, ZWJ sequences) come as
 * dash-joined hex — they assemble back into the rendered glyph.
 */
function unicodeFromClasses(classes: DOMTokenList): string | null {
  for (const cls of classes) {
    if (!cls.startsWith(EMOJI_CODEPOINT_PREFIX) || cls === EMOJI_CLASS) {
      continue;
    }
    const hexes = cls.slice(EMOJI_CODEPOINT_PREFIX.length).split("-");
    const codepoints: number[] = [];
    for (const hex of hexes) {
      if (!/^[0-9a-f]+$/i.test(hex)) {
        return null;
      }
      const value = Number.parseInt(hex, 16);
      if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
        return null;
      }
      codepoints.push(value);
    }
    if (codepoints.length === 0) {
      return null;
    }
    return String.fromCodePoint(...codepoints);
  }
  return null;
}

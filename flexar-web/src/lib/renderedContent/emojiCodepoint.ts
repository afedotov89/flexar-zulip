// Pure helper: extract the unicode glyph from a Zulip emoji element's
// class list.
//
// Zulip's renderer encodes the codepoint(s) of a unicode emoji in the
// `emoji-XXXX` class on the wrapping element (a `<span>` for unicode
// emoji, a `<img>` for custom realm emoji that is not unicode-backed).
// Multi-codepoint emojis (flags, ZWJ sequences, skin-tone modifiers)
// come as dash-joined hex — e.g. `emoji-1f1f7-1f1fa` for the Russia
// flag, `emoji-1f468-200d-1f4bb` for "man technologist". They
// assemble back into a single rendered glyph via `String.fromCodePoint`.
//
// Two surfaces consume this: `decorateEmojis` rewrites live message-DOM
// spans to show the glyph instead of the colon-shortcode fallback;
// `htmlToPlainText` snapshots rendered_content for previews (Recent
// rows, …) and needs the same decoding so snippets don't display
// `:point_right:` instead of the emoji. Keep this function alone in
// `lib/` so neither surface owns the codec.

const EMOJI_CLASS = "emoji";
const EMOJI_CODEPOINT_PREFIX = "emoji-";

/**
 * Return the unicode glyph encoded in an emoji element's class list,
 * or `null` if no `emoji-<hex>` class is present or the codepoints are
 * unparseable. The lookup is forgiving — extra classes in the list are
 * ignored — and never throws.
 *
 * Accepts both `DOMTokenList` (from a live element's `classList`) and
 * `Iterable<string>` (from a freshly-parsed `className` split) so
 * callers in different parsing pipelines don't need to coerce.
 */
export function unicodeFromEmojiClasses(
  classes: Iterable<string>,
): string | null {
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

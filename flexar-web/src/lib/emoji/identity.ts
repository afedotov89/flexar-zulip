// Flexar Hub Web — emoji identity helpers (Phase 3.2).
//
// Phase 2.3 introduced the bundled `EMOJI_CORPUS` (`{shortcode, glyph}`
// pairs) for the compose `:` typeahead. Phase 3.2 (reactions) needs to
// move between three different shapes:
//
//   - the corpus entry itself (what the picker iterates over);
//   - the wire/domain `EmojiIdentity` triple (`emoji_name`, `emoji_code`,
//     `reaction_type`) the API and `Reaction[]` use;
//   - the displayable Unicode glyph for an existing reaction (whose
//     `emoji_code` is dash-separated hex, mirroring the codepoint
//     encoding Zulip's renderer emits in HTML — see
//     `messageFeed/renderedContent/emoji.ts`).
//
// These helpers are pure and unit-tested; they touch no state.

import { EMOJI_CORPUS, type EmojiEntry } from "./corpus";
import type { EmojiIdentity, ReactionType } from "../../domain";

/**
 * Encode a Unicode emoji glyph as a Zulip `emoji_code`: the
 * dash-separated lowercase hex sequence of its codepoints. This matches
 * the on-the-wire form (`1f44d` for `👍`, `2764-fe0f` for `❤️`) that
 * the server emits and the API expects.
 *
 * Iterates by code point — surrogate pairs in multi-codepoint glyphs
 * (flags, ZWJ sequences) become correctly separated hex tokens.
 */
export function emojiCodeFromGlyph(glyph: string): string {
  const codepoints: string[] = [];
  for (const ch of glyph) {
    const code = ch.codePointAt(0);
    if (code === undefined) {
      continue;
    }
    codepoints.push(code.toString(16));
  }
  return codepoints.join("-");
}

/**
 * Decode a Zulip `unicode_emoji` `emoji_code` (dash-separated hex
 * codepoints) back into the displayable Unicode string. Returns `null`
 * if the input is empty, malformed, or out of range — callers fall back
 * to the colon-shortcode in that case.
 *
 * Mirrors the logic in
 * `features/messageFeed/renderedContent/emoji.ts:unicodeFromClasses`,
 * which derives the same glyph from Zulip's HTML class encoding.
 */
export function glyphFromUnicodeEmojiCode(emojiCode: string): string | null {
  if (emojiCode === "") {
    return null;
  }
  const codepoints: number[] = [];
  for (const hex of emojiCode.split("-")) {
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

/**
 * The shape used to display a reaction in the chip row: a glyph for
 * `unicode_emoji` (rendered as text), or the colon-shortcode for the
 * other namespaces (`realm_emoji`, `zulip_extra_emoji`) — custom emoji
 * images are out of scope for this phase, the same as in `EMOJI_CORPUS`.
 */
export function reactionDisplayGlyph(identity: EmojiIdentity): string {
  if (identity.reaction_type === "unicode_emoji") {
    const glyph = glyphFromUnicodeEmojiCode(identity.emoji_code);
    if (glyph !== null) {
      return glyph;
    }
  }
  return `:${identity.emoji_name}:`;
}

/**
 * Build an `EmojiIdentity` for a corpus entry: the picker hands the
 * triple to the add-reaction action, and the optimistic-reaction
 * reducer stores the same triple on the message.
 */
export function identityFromCorpusEntry(entry: EmojiEntry): EmojiIdentity {
  return {
    emoji_name: entry.shortcode,
    emoji_code: emojiCodeFromGlyph(entry.glyph),
    reaction_type: "unicode_emoji" satisfies ReactionType,
  };
}

/** The corpus entry whose shortcode matches `name`, or `undefined`. */
export function corpusEntryByName(name: string): EmojiEntry | undefined {
  return EMOJI_CORPUS.find((entry) => entry.shortcode === name);
}

// Flexar Hub Web — bundled emoji corpus public surface (Phase 2.3+3.2).
//
// A small, curated set of Unicode emoji shortcodes used by the `:`
// typeahead in the compose box and by the reaction picker. Custom realm
// emoji are intentionally out of scope (see `corpus.ts` header).
//
// Identity helpers move between the corpus shape, the wire/domain
// `EmojiIdentity` triple, and the displayable glyph for an existing
// reaction's `emoji_code` (see `identity.ts`).

export { EMOJI_CORPUS, type EmojiEntry } from "./corpus";
export {
  corpusEntryByName,
  emojiCodeFromGlyph,
  glyphFromUnicodeEmojiCode,
  identityFromCorpusEntry,
  reactionDisplayGlyph,
} from "./identity";

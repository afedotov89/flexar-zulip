// Flexar Hub Web — emoji picker filter (Phase 3.2).
//
// Reaction-picker query: a case-insensitive substring match on the
// shortcode. The compose `:` typeahead has its own multi-tier ranking
// (`features/compose/typeahead/sources.ts:emojiRows`) — the picker is
// simpler: substring filter, otherwise corpus order. Empty query returns
// the corpus unchanged.

import { EMOJI_CORPUS, type EmojiEntry } from "../../lib/emoji";

/**
 * Filter the bundled corpus by a substring query (case-insensitive,
 * matched against `shortcode`). An empty/whitespace query returns the
 * full corpus in its declared order.
 */
export function filterEmoji(
  query: string,
  corpus: readonly EmojiEntry[] = EMOJI_CORPUS,
): readonly EmojiEntry[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") {
    return corpus;
  }
  return corpus.filter((entry) =>
    entry.shortcode.toLowerCase().includes(trimmed),
  );
}

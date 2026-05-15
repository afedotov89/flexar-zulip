// Flexar Hub Web — typeahead trigger detector (Phase 2.3).
//
// Pure helper: given the message textarea's current `value` and the
// `cursor` position (`selectionStart`), decide whether the cursor sits
// inside a typeahead token, and if so return the token's kind, the
// query text typed so far, and the `[start, end)` slice of `value`
// the eventual selection should replace.
//
// ── Boundary rules (intentional and tested) ─────────────────────────
//
// A trigger character only opens a typeahead when one of:
//
//   - it is at the very start of the string, OR
//   - the immediately preceding character is whitespace, OR
//   - the immediately preceding character is one of the "phrase"
//     punctuation marks `( [ { , ; : ` (so e.g. typing `(@al` opens
//     the mention typeahead, like every chat app does).
//
// In every other case the character is part of an unrelated token and
// the typeahead stays closed. Concretely:
//   - `email@host`   — `@` follows a letter → no mention typeahead
//   - `prefix#tag`   — `#` follows a letter → no channel typeahead
//   - `time:00:30`   — `:` follows a digit  → no emoji typeahead
//
// ── Query extent ────────────────────────────────────────────────────
//
// The query is the run of characters from just after the trigger to
// the cursor. We close the typeahead the moment the *intervening* text
// (between the trigger and the cursor) contains a character that is
// neither a name-character nor a single inner space (mentions and
// channels can have spaces in their names; emoji shortcodes cannot).
// The query is allowed to be empty — typing `@` alone opens the
// mention typeahead with the whole directory.
//
// ── Multi-trigger resolution ────────────────────────────────────────
//
// We scan backwards from the cursor for the *last* trigger character
// whose boundary check passes; that wins. Earlier characters of the
// string are irrelevant to whichever token currently surrounds the
// cursor.

export type TypeaheadTriggerKind = "mention" | "channel" | "emoji";

export interface TypeaheadTrigger {
  kind: TypeaheadTriggerKind;
  /** Substring typed since the trigger character (may be empty). */
  query: string;
  /**
   * Inclusive start offset of the slice to replace on selection — points
   * at the trigger character itself.
   */
  start: number;
  /** Exclusive end offset — equal to the cursor position. */
  end: number;
}

const TRIGGERS: Record<string, TypeaheadTriggerKind> = {
  "@": "mention",
  "#": "channel",
  ":": "emoji",
};

// Characters that may legally precede a trigger and still allow the
// typeahead to open. Whitespace covers spaces, tabs and newlines via
// the `\s` test; this set covers the punctuation cases.
const PHRASE_PUNCT = new Set([
  "(",
  "[",
  "{",
  ",",
  ";",
  ":",
  "—",
  "–",
  "-",
  ">",
  "*",
  "_",
]);

function isTriggerBoundary(prev: string | undefined): boolean {
  if (prev === undefined) {
    // Trigger at start of string.
    return true;
  }
  if (/\s/.test(prev)) {
    return true;
  }
  return PHRASE_PUNCT.has(prev);
}

// Inside a `mention` or `channel` query, name characters and inner
// spaces are allowed (full names and channel names contain spaces).
// Everything that would terminate the token closes the query —
// newlines, and the trigger characters themselves (so `@al @bo|` opens
// the typeahead at `@bo`, not at `@al @bo`).
function isQueryCharForName(ch: string): boolean {
  if (ch === "\n" || ch === "\r") {
    return false;
  }
  if (ch === "@" || ch === "#" || ch === ":") {
    return false;
  }
  return true;
}

// Emoji shortcodes don't contain spaces, so the query character class
// is stricter — letters, digits and underscores. Anything else closes
// the typeahead. (The corpus enforces the `[a-z0-9_]+` shape too.)
function isQueryCharForEmoji(ch: string): boolean {
  return /^[A-Za-z0-9_]$/.test(ch);
}

/**
 * Detect the typeahead token under the cursor, if any.
 *
 * Returns `null` when the cursor is not inside a typeahead token; an
 * object describing the kind, query and slice to replace otherwise.
 *
 * @param value — the textarea's `value`.
 * @param cursor — the textarea's `selectionStart`.
 */
export function detectTrigger(
  value: string,
  cursor: number,
): TypeaheadTrigger | null {
  if (cursor < 0 || cursor > value.length) {
    return null;
  }
  // Scan backwards from the cursor looking for a trigger character whose
  // intervening run is a valid query and whose boundary check passes.
  // Cap the scan at a sane query length (64 chars) so a very long line
  // without a trigger doesn't waste time.
  const minIndex = Math.max(0, cursor - 64);
  const queryEndsAt = cursor;
  for (let i = cursor - 1; i >= minIndex; i -= 1) {
    const ch = value[i];
    const kind = TRIGGERS[ch];
    if (kind !== undefined) {
      // Boundary check: what's just before the trigger?
      const prev = i === 0 ? undefined : value[i - 1];
      if (!isTriggerBoundary(prev)) {
        // This trigger is part of an unrelated token (`email@host`,
        // `time:00`, …). Don't open here, and don't keep scanning past
        // it — anything earlier is in a different word.
        return null;
      }
      const query = value.slice(i + 1, queryEndsAt);
      // Reject queries with a trailing space — `@al ` is not active.
      // The query is allowed to *contain* a single inner space for
      // mention/channel kinds, but the typeahead shouldn't open from a
      // dangling whitespace tail.
      if (query.endsWith(" ") || query.endsWith("\t")) {
        return null;
      }
      // Emoji queries with a space are invalid by definition.
      if (kind === "emoji" && /\s/.test(query)) {
        return null;
      }
      return {
        kind,
        query,
        start: i,
        end: cursor,
      };
    }
    // Not a trigger — must be a query char for *some* kind, else close.
    // We scan optimistically (any char that's a valid name char or
    // emoji char keeps the search going); if we run out without
    // finding a trigger, return null.
    if (!isQueryCharForName(ch) && !isQueryCharForEmoji(ch)) {
      return null;
    }
  }
  return null;
}

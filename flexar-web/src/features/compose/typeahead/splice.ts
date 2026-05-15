// Flexar Hub Web — typeahead splice helper (Phase 2.3).
//
// Pure helper: replace `value[start..end)` with `replacement` and a
// trailing space, and return the new string and the new cursor offset.
//
// The trailing space is what makes the typeahead "feel right" — after
// selecting `@Hamlet` you keep typing immediately, you don't have to
// reach for spacebar before the next word. The cursor lands after the
// space.
//
// Splitting this out from the React layer keeps the splice math
// independently unit-tested and free of DOM/refs.

export interface TypeaheadSpliceArgs {
  value: string;
  /** Inclusive start of the slice to replace (`detectTrigger`'s `start`). */
  start: number;
  /** Exclusive end of the slice to replace (`detectTrigger`'s `end`). */
  end: number;
  /** The text to splice in (e.g. `@**Iago**`, `:smile:`, `#**design**`). */
  replacement: string;
}

export interface TypeaheadSpliceResult {
  /** The new value to set on the textarea/input. */
  value: string;
  /** The new cursor position to set (`selectionStart`/`selectionEnd`). */
  cursor: number;
}

export function spliceTypeahead({
  value,
  start,
  end,
  replacement,
}: TypeaheadSpliceArgs): TypeaheadSpliceResult {
  const before = value.slice(0, start);
  const after = value.slice(end);
  // If the user already typed a space after the token (this happens
  // mid-edit when they jump back into a token), don't double it.
  const needsSpace = !after.startsWith(" ") && !after.startsWith("\n");
  const insertion = needsSpace ? `${replacement} ` : replacement;
  return {
    value: `${before}${insertion}${after}`,
    cursor: before.length + insertion.length,
  };
}

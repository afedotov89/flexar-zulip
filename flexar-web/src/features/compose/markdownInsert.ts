// Markdown insert helpers for the compose-box formatting toolbar.
//
// Every helper is pure: given the current value + selection range, it
// returns the new value and the new selection range. The caller (the
// compose box) is responsible for actually writing the new value back
// to the controlled state and calling `setSelectionRange` on the
// textarea node.
//
// Two patterns:
//
//   - Inline wraps (`bold`, `italic`, `strikethrough`, `inline code`,
//     `spoiler`, `math`): if the selection is non-empty, wrap it with
//     the delimiters and keep it selected so the next keystroke
//     replaces it. If the selection is empty, insert the delimiters
//     and place the caret between them so the user can start typing
//     the content.
//
//   - Line prefixes (`> ` quote, `- ` bulleted list, `1. ` numbered):
//     find the line range covered by the selection; prefix every line.
//     Numbered lists number sequentially. The selection grows to cover
//     the now-prefixed lines.
//
//   - Block-level: code block (triple backticks on their own lines)
//     and link (the only one that takes external input — the URL).
//
// These helpers don't know about React; they're tested as plain
// functions in `markdownInsert.test.ts`.

export interface SelectionRange {
  /** Caret start (inclusive). */
  start: number;
  /** Caret end (exclusive). When `start === end`, the caret is collapsed. */
  end: number;
}

export interface InsertResult {
  /** The new full textarea value. */
  value: string;
  /** The new selection range to apply. */
  selection: SelectionRange;
}

/**
 * Wrap the current selection with `prefix` + `suffix`. If nothing is
 * selected, insert the pair and place the caret in the middle.
 *
 * Used for `**bold**`, `*italic*`, `~~strikethrough~~`, `` `code` ``,
 * `$$math$$`, and the spoiler shorthand. The suffix defaults to the
 * prefix when only one symbol is supplied — covers the symmetric cases.
 */
export function wrapSelection(
  value: string,
  selection: SelectionRange,
  prefix: string,
  suffix: string = prefix,
): InsertResult {
  const { start, end } = selection;
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  if (selected === "") {
    // Empty selection: drop the pair in, caret between them.
    const insertion = `${prefix}${suffix}`;
    return {
      value: `${before}${insertion}${after}`,
      selection: {
        start: start + prefix.length,
        end: start + prefix.length,
      },
    };
  }
  // Non-empty: wrap, keep the inner text selected so the user can
  // adjust it without first un-selecting.
  return {
    value: `${before}${prefix}${selected}${suffix}${after}`,
    selection: {
      start: start + prefix.length,
      end: end + prefix.length,
    },
  };
}

/**
 * Insert a Markdown link `[text](url)`. Uses the current selection as
 * the link text (or falls back to a hint when the selection is empty).
 * The caret ends up inside the URL portion so the user can paste it.
 */
export function insertLink(
  value: string,
  selection: SelectionRange,
  url: string = "",
): InsertResult {
  const { start, end } = selection;
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  const text = selected !== "" ? selected : "текст";
  const insertion = `[${text}](${url})`;
  const value2 = `${before}${insertion}${after}`;

  if (selected === "") {
    // No selection: select the "текст" placeholder so the user can
    // overwrite it immediately.
    return {
      value: value2,
      selection: { start: start + 1, end: start + 1 + text.length },
    };
  }
  // Selection existed: place the caret in the (empty) URL portion so
  // the user can paste / type the URL right away.
  const urlStart = start + 1 + text.length + 2; // after `[text](`
  return {
    value: value2,
    selection: { start: urlStart, end: urlStart + url.length },
  };
}

/**
 * Add a prefix (e.g. `> `, `- `) to every line in the selected range.
 * Lines wholly outside the selection are untouched. If the selection
 * is collapsed, the line under the caret gets the prefix.
 *
 * The returned selection covers the prefixed lines (start of the first
 * line to the end of the last line + last prefix), so successive
 * toggles act on the same block.
 */
export function prefixLines(
  value: string,
  selection: SelectionRange,
  prefix: string,
): InsertResult {
  const { lineStart, lineEnd, lines } = sliceLines(value, selection);
  const prefixed = lines.map((line) => `${prefix}${line}`);
  const newBlock = prefixed.join("\n");
  const before = value.slice(0, lineStart);
  const after = value.slice(lineEnd);
  return {
    value: `${before}${newBlock}${after}`,
    selection: {
      start: lineStart,
      end: lineStart + newBlock.length,
    },
  };
}

/**
 * Numbered list: `1. `, `2. `, `3. ` — sequential prefixes on each line.
 */
export function insertNumberedList(
  value: string,
  selection: SelectionRange,
): InsertResult {
  const { lineStart, lineEnd, lines } = sliceLines(value, selection);
  const prefixed = lines.map((line, index) => `${index + 1}. ${line}`);
  const newBlock = prefixed.join("\n");
  const before = value.slice(0, lineStart);
  const after = value.slice(lineEnd);
  return {
    value: `${before}${newBlock}${after}`,
    selection: {
      start: lineStart,
      end: lineStart + newBlock.length,
    },
  };
}

/**
 * Insert a fenced code block:
 *
 *     ```
 *     <selection or caret here>
 *     ```
 *
 * The code-fence lives on its own lines, separated from surrounding
 * content by a blank line if there's existing text nearby.
 */
export function insertCodeBlock(
  value: string,
  selection: SelectionRange,
): InsertResult {
  const { start, end } = selection;
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  // Pad with blank lines only when there is adjacent non-blank text.
  const leadingPad = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "" : "\n\n";
  const trailingPad = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "" : "\n\n";

  const inner = selected !== "" ? selected : "";
  const block = `\`\`\`\n${inner}\n\`\`\``;
  const insertion = `${leadingPad}${block}${trailingPad}`;
  const value2 = `${before}${insertion}${after}`;

  // Land the caret on the empty line between the fences when there
  // was no selection, otherwise keep the selection over the fenced
  // content.
  const innerStart = start + leadingPad.length + 4; // after "```\n"
  if (selected === "") {
    return {
      value: value2,
      selection: { start: innerStart, end: innerStart },
    };
  }
  return {
    value: value2,
    selection: { start: innerStart, end: innerStart + inner.length },
  };
}

/**
 * Find the line range covered by `selection` — the byte indices of
 * the first line's start and the last line's end (exclusive), plus
 * the lines themselves split on `\n`.
 *
 * Behaves the same whether the selection is collapsed or extended.
 */
function sliceLines(
  value: string,
  selection: SelectionRange,
): { lineStart: number; lineEnd: number; lines: string[] } {
  const { start, end } = selection;
  // Walk left from `start` until we find a `\n` or hit the beginning.
  let lineStart = start;
  while (lineStart > 0 && value[lineStart - 1] !== "\n") {
    lineStart -= 1;
  }
  // Walk right from `end` until we find a `\n` or hit the end. For an
  // extended selection ending exactly on a `\n`, exclude that newline
  // — otherwise we'd accidentally include the trailing empty line.
  let lineEnd = end;
  if (lineEnd > start && value[lineEnd - 1] === "\n") {
    lineEnd -= 1;
  }
  while (lineEnd < value.length && value[lineEnd] !== "\n") {
    lineEnd += 1;
  }
  const block = value.slice(lineStart, lineEnd);
  return {
    lineStart,
    lineEnd,
    lines: block.split("\n"),
  };
}

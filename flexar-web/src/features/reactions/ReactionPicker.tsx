// Flexar Hub Web — reaction picker (Phase 3.2).
//
// The contents of the popover that opens from the message-row hover
// toolbar's "Add reaction" button (and the "+" affordance at the end of
// the chip row when reactions already exist).
//
// Layout: a `Input` search field at the top, a grid of emoji glyphs
// below (the bundled `EMOJI_CORPUS`, filtered by the query). Clicking a
// glyph calls `onPick` with the emoji's identity triple and the parent
// closes the popover.
//
// Keyboard model:
//   - `Popover` autofocuses the first tabbable element on open — the
//     search input. The user types to filter immediately.
//   - From the input, ArrowDown moves focus into the grid. Arrows move
//     between cells (column-major navigation, wrapping at row edges via
//     the natural index). Enter on a cell picks it; Escape closes (the
//     popover handles Escape).
//   - Each cell is a real `<button>` so it is in the natural tab order
//     and screen readers announce it. The grid uses `role="grid"` with
//     `role="row"`/`role="gridcell"` and `aria-label`s naming the emoji.
//
// Filter: substring on shortcode, see `filterEmoji`.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "../../components/Input";
import type { EmojiIdentity } from "../../domain";
import { identityFromCorpusEntry, type EmojiEntry } from "../../lib/emoji";
import { filterEmoji } from "./filterEmoji";
import styles from "./ReactionPicker.module.css";

export interface ReactionPickerProps {
  /** Called with the picked emoji's identity triple. */
  onPick: (identity: EmojiIdentity) => void;
}

/** How many columns the emoji grid lays out. Must match the CSS. */
const GRID_COLUMNS = 8;

export function ReactionPicker({
  onPick,
}: ReactionPickerProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterEmoji(query), [query]);
  // Ref the grid so we can move focus into / between its buttons by
  // index — the grid is a single `<div role="grid">` whose direct cells
  // are the buttons.
  const gridRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Reset focus to the first cell whenever the filtered list changes
  // out from under the user (e.g. the previously focused index no
  // longer exists). We do not steal focus while the user is typing in
  // the input; we only restore it if focus had already moved into the
  // grid and the previously focused cell is gone.
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) {
      return;
    }
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || !grid.contains(active)) {
      return;
    }
    const cells = cellButtons(grid);
    if (cells.length === 0) {
      return;
    }
    if (!cells.includes(active)) {
      cells[0].focus();
    }
  }, [filtered]);

  const handlePick = useCallback(
    (entry: EmojiEntry) => {
      onPick(identityFromCorpusEntry(entry));
    },
    [onPick],
  );

  // Keyboard nav: bind on the input and the grid so keys work whether
  // focus is in the search box or on a cell.
  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "ArrowDown") {
        return;
      }
      const grid = gridRef.current;
      if (grid === null) {
        return;
      }
      const cells = cellButtons(grid);
      if (cells.length === 0) {
        return;
      }
      event.preventDefault();
      cells[0].focus();
    },
    [],
  );

  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const grid = gridRef.current;
      if (grid === null) {
        return;
      }
      const cells = cellButtons(grid);
      if (cells.length === 0) {
        return;
      }
      const active = document.activeElement;
      if (!(active instanceof HTMLButtonElement)) {
        return;
      }
      const index = cells.indexOf(active);
      if (index < 0) {
        return;
      }
      const move = (next: number): void => {
        if (next < 0 || next >= cells.length) {
          return;
        }
        event.preventDefault();
        cells[next].focus();
      };
      switch (event.key) {
        case "ArrowRight":
          move(index + 1);
          return;
        case "ArrowLeft":
          move(index - 1);
          return;
        case "ArrowDown":
          move(index + GRID_COLUMNS);
          return;
        case "ArrowUp":
          if (index < GRID_COLUMNS) {
            // Top row → return to the search input.
            const input = document.getElementById(inputId);
            if (input instanceof HTMLInputElement) {
              event.preventDefault();
              input.focus();
            }
            return;
          }
          move(index - GRID_COLUMNS);
          return;
        case "Home":
          move(0);
          return;
        case "End":
          move(cells.length - 1);
          return;
        default:
          return;
      }
    },
    [inputId],
  );

  return (
    <div className={styles.picker}>
      <div className={styles.searchRow}>
        <Input
          id={inputId}
          size="sm"
          iconLeft="search"
          placeholder="Find emoji"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          aria-label="Find emoji"
          autoComplete="off"
        />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty} role="status">
          No emoji match.
        </div>
      ) : (
        <div
          ref={gridRef}
          className={styles.grid}
          role="grid"
          aria-label="Emoji"
          onKeyDown={handleGridKeyDown}
        >
          {filtered.map((entry) => (
            <button
              key={entry.shortcode}
              type="button"
              role="gridcell"
              className={styles.cell}
              aria-label={`:${entry.shortcode}:`}
              title={`:${entry.shortcode}:`}
              onClick={() => handlePick(entry)}
            >
              <span className={styles.glyph} aria-hidden="true">
                {entry.glyph}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Direct-child cell buttons of the grid, in DOM order. The picker
 * builds them from a flat list so this is just the children — but going
 * through `querySelectorAll` keeps the helper robust to wrapping
 * changes.
 */
function cellButtons(grid: HTMLElement): HTMLButtonElement[] {
  return Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
}

/** Re-export so tests and callers can refer to the picker's column count. */
export { GRID_COLUMNS };

// Flexar Hub Web — emoji picker for the compose box (Phase 3.6).
//
// The contents of the popover that opens from the smiley-face button
// next to the Send action. Inserts the picked emoji's `:shortcode:`
// at the textarea's caret — Markdown source is the right thing to
// insert here, since the message round-trips through Zulip's
// server-side renderer (which turns `:smile:` into 😄 anyway).
//
// Surface: bundled Unicode corpus + the organisation's custom realm
// emoji from `useRealmEmojiStore`. Realm emoji render their `<img>`
// directly; Unicode emoji render their glyph. Both are addressed by
// `:shortcode:` insertion.
//
// Layout, search behaviour and keyboard model mirror the reactions
// picker (`features/reactions/ReactionPicker`) — the patterns are
// identical, only the entry list and what "pick" means differ.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "../../../components/Input";
import type { RealmEmoji } from "../../../domain";
import { EMOJI_CORPUS, type EmojiEntry } from "../../../lib/emoji";
import { useRealmEmojiStore } from "../../../stores/realmEmojiStore";
import styles from "./ComposeEmojiPicker.module.css";

/** Number of emoji columns in the grid. Must match the CSS. */
const GRID_COLUMNS = 8;

/**
 * One row of the emoji picker. Discriminated on `kind` so the renderer
 * can pick the right glyph (`<span>` for unicode, `<img>` for realm).
 */
type PickerEntry =
  | { kind: "unicode"; shortcode: string; entry: EmojiEntry }
  | { kind: "realm"; shortcode: string; emoji: RealmEmoji };

export interface ComposeEmojiPickerProps {
  /**
   * Called with the `:shortcode:` markdown the textarea should insert.
   * The parent owns the textarea + cursor; this component just emits
   * what was picked and lets the caller close the popover.
   */
  onPick: (shortcodeMarkdown: string) => void;
}

export function ComposeEmojiPicker({
  onPick,
}: ComposeEmojiPickerProps): React.JSX.Element {
  const realmList = useRealmEmojiStore((s) => s.listActive)();

  const [query, setQuery] = useState("");

  // Combine the bundled unicode corpus and the active realm emoji into
  // one searchable, ordered list — realm emoji first (they are local
  // to the org and tend to be the most relevant for in-team chats),
  // then the bundled corpus.
  const entries = useMemo<PickerEntry[]>(() => {
    const all: PickerEntry[] = [];
    for (const emoji of realmList) {
      all.push({ kind: "realm", shortcode: emoji.name, emoji });
    }
    for (const entry of EMOJI_CORPUS) {
      all.push({ kind: "unicode", shortcode: entry.shortcode, entry });
    }
    const trimmed = query.trim().toLowerCase();
    if (trimmed === "") {
      return all;
    }
    return all.filter((e) => e.shortcode.toLowerCase().includes(trimmed));
  }, [realmList, query]);

  const gridRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Keep focus management consistent with ReactionPicker — see the
  // header of `ReactionPicker.tsx` for the why.
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
  }, [entries]);

  const handlePick = useCallback(
    (entry: PickerEntry) => {
      onPick(`:${entry.shortcode}:`);
    },
    [onPick],
  );

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
      {entries.length === 0 ? (
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
          {entries.map((entry) => (
            <button
              key={`${entry.kind}-${entry.shortcode}`}
              type="button"
              role="gridcell"
              className={styles.cell}
              aria-label={`:${entry.shortcode}:`}
              title={`:${entry.shortcode}:`}
              onClick={() => handlePick(entry)}
            >
              {entry.kind === "unicode" ? (
                <span className={styles.glyph} aria-hidden="true">
                  {entry.entry.glyph}
                </span>
              ) : (
                <img
                  className={styles.realmGlyph}
                  src={entry.emoji.source_url}
                  alt=""
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function cellButtons(grid: HTMLElement): HTMLButtonElement[] {
  return Array.from(grid.querySelectorAll<HTMLButtonElement>("button"));
}

export { GRID_COLUMNS };

// Flexar Hub Web — typeahead panel (Phase 2.3).
//
// Generic listbox surface for the compose typeaheads. Portaled and
// positioned with the shared `_overlay` helpers, but unlike `Popover`
// it never moves focus into itself: focus stays on the textarea/input
// the whole time so the user can keep typing. The selection state is
// driven from outside via `activeId`; the panel only renders.
//
// Anchored under the trigger field (textarea or topic input). Anchoring
// per-character within a textarea is fiddly across font/zoom settings;
// "below the field" is a clean, correct default.
//
// a11y model:
//   - the field carries `role="combobox"`, `aria-autocomplete="list"`,
//     `aria-controls` pointing at this panel's id,
//     `aria-activedescendant` set to the active row's id; (the calling
//     component sets these.)
//   - the panel itself uses `role="listbox"` with the panel id;
//   - rows use `role="option"`, with `aria-selected` on the active row;
//   - mouse-down (not click) on a row triggers selection — `mousedown`
//     fires before the textarea's `blur`, which would otherwise close
//     the panel out from under us.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Portal, useOverlayPosition } from "../../../components/_overlay";
import styles from "./TypeaheadPanel.module.css";

export interface TypeaheadPanelRow {
  /** Stable DOM id consumed by `aria-activedescendant`. */
  id: string;
  /** Plain-text accessible name (announced by AT). */
  label: string;
  /** Visual content for the row. */
  render: () => React.ReactNode;
}

export interface TypeaheadPanelProps {
  /** DOM id of the panel — must match the field's `aria-controls`. */
  panelId: string;
  /** The element to anchor against (the textarea or topic input). */
  anchor: HTMLElement | null;
  /** Whether the panel is open and rendered. */
  open: boolean;
  rows: readonly TypeaheadPanelRow[];
  /** Active row id (the one with `aria-selected="true"`). */
  activeId: string | null;
  /** Called when the user picks a row by mouse. */
  onSelect: (id: string) => void;
  /** Called when the user hovers a row (drives keyboard active sync). */
  onHover: (id: string) => void;
  /** Accessible label for the listbox. */
  ariaLabel: string;
}

export function TypeaheadPanel({
  panelId,
  anchor,
  open,
  rows,
  activeId,
  onSelect,
  onHover,
  ariaLabel,
}: TypeaheadPanelProps): React.JSX.Element | null {
  // The panel node is tracked in state (not just a ref) so positioning
  // re-runs once it mounts. A bare ref mutation does not trigger the
  // render `useOverlayPosition` needs.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    panelRef.current = node;
    setPanel(node);
  }, []);

  useOverlayPosition({
    anchor,
    floating: panel,
    placement: "bottom",
    enabled: open && rows.length > 0,
  });

  // Re-anchor the panel's width to the field's width — the typeahead
  // looks awkward when much narrower or wider than the input it serves.
  useLayoutEffect(() => {
    if (!open || anchor === null || panel === null) {
      return;
    }
    const width = anchor.getBoundingClientRect().width;
    if (width > 0) {
      panel.style.setProperty("--typeahead-width", `${Math.round(width)}px`);
    }
  }, [open, anchor, panel, rows.length]);

  // Scroll the active row into view when it changes via keyboard.
  useLayoutEffect(() => {
    if (!open || activeId === null || panel === null) {
      return;
    }
    const row = panel.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(activeId)}"]`,
    );
    if (row !== null && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeId, panel]);

  if (!open || rows.length === 0) {
    return null;
  }

  return (
    <Portal>
      <div
        ref={setPanelRef}
        id={panelId}
        role="listbox"
        aria-label={ariaLabel}
        className={styles.panel}
      >
        {rows.map((row) => {
          const isActive = row.id === activeId;
          const className = [styles.row, isActive && styles.rowActive]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={row.id}
              id={row.id}
              role="option"
              aria-selected={isActive}
              data-row-id={row.id}
              className={className}
              // mousedown (not click) so the selection happens before
              // the field's blur tears the panel down.
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(row.id);
              }}
              onMouseEnter={() => onHover(row.id)}
            >
              {row.render()}
            </div>
          );
        })}
      </div>
    </Portal>
  );
}

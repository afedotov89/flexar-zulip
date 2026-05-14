// Flexar Hub Web — Tabs primitive (Phase 0.6).
//
// Horizontal tab bar plus one panel. The component is controlled:
// the parent owns `activeId` and updates it from `onChange`.
//
// Panel content is supplied through `children` as a render prop —
// `(activeId) => ReactNode` — so the parent renders exactly the active
// panel and Tabs stays presentational. A single `role="tabpanel"`
// wraps the rendered output and is wired to the active tab via
// `aria-controls` / `aria-labelledby`.
//
// Keyboard model (WAI-ARIA tabs pattern): roving tabindex — only the
// active tab is in the tab order; ArrowLeft/ArrowRight move (and wrap)
// between tabs, Home/End jump to the first/last. Moving focus also
// activates the tab (automatic activation).
//
// States covered on each tab: hover, focus-visible, active/selected,
// disabled. The active-tab indicator slides via `--duration-base`.

import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  /** Stable identifier, unique within the tab set. */
  id: string;
  /** Visible tab label. */
  label: string;
  /** When true, the tab is shown but not selectable. */
  disabled?: boolean;
}

export interface TabsProps {
  /** The tabs to render, in display order. */
  tabs: TabItem[];
  /** The currently selected tab id. */
  activeId: string;
  /** Called with the new tab id when the selection changes. */
  onChange: (id: string) => void;
  /** Render prop for the active panel's content. */
  children: (activeId: string) => ReactNode;
  /** Accessible label for the tab list. */
  "aria-label"?: string;
  className?: string;
}

export function Tabs({
  tabs,
  activeId,
  onChange,
  children,
  "aria-label": ariaLabel,
  className,
}: TabsProps): React.JSX.Element {
  const baseId = useId();
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const tabId = (id: string): string => `${baseId}-tab-${id}`;
  const panelId = (id: string): string => `${baseId}-panel-${id}`;

  const selectableIds = tabs
    .filter((tab) => !tab.disabled)
    .map((tab) => tab.id);

  function focusAndSelect(id: string): void {
    onChange(id);
    tabRefs.current.get(id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (selectableIds.length === 0) {
      return;
    }
    const currentIndex = selectableIds.indexOf(activeId);
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % selectableIds.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex =
          (currentIndex - 1 + selectableIds.length) % selectableIds.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = selectableIds.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusAndSelect(selectableIds[nextIndex]);
  }

  const classes = [styles.tabs, className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <div className={styles.tablist} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className={[styles.tab, selected && styles.tabSelected]
                .filter(Boolean)
                .join(" ")}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              aria-disabled={tab.disabled || undefined}
              disabled={tab.disabled}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(tab.id, node);
                } else {
                  tabRefs.current.delete(tab.id);
                }
              }}
              onClick={() => {
                if (!tab.disabled) {
                  onChange(tab.id);
                }
              }}
              onKeyDown={handleKeyDown}
            >
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(activeId)}
        aria-labelledby={tabId(activeId)}
        tabIndex={0}
        className={styles.panel}
      >
        {children(activeId)}
      </div>
    </div>
  );
}

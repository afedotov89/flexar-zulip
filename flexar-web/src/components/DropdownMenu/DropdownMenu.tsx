// Flexar Hub Web — DropdownMenu primitive (Phase 0.6, group D).
//
// An actions menu: a trigger plus a list of selectable items and
// optional separators. It reuses `Popover` for the floating panel,
// outside-click/`Escape` dismissal and focus restoration — this
// component only adds the menu semantics and keyboard model on top.
//
// API — uncontrolled by default (the menu owns its open state); pass
// `open` + `onOpenChange` to control it, same contract as `Popover`.
//
// Keyboard model (roving tabindex):
//   - `ArrowDown` / `ArrowUp` move between enabled items (wrapping),
//   - `Home` / `End` jump to the first / last enabled item,
//   - `Enter` / `Space` activate the focused item,
//   - `Escape` closes (handled by Popover's `useDismiss`).
// On open, Popover focuses the first tabbable element — which is the
// first enabled item, because items carry `tabIndex={0}` when active
// and `-1` otherwise.
//
// a11y: the list is `role="menu"`, each item `role="menuitem"`,
// separators `role="separator"`. Disabled items get `aria-disabled`.

import { useCallback, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Icon } from "../Icon";
import type { IconName } from "../../icons";
import { Popover } from "../Popover";
import type { OverlayPlacement } from "../_overlay";
import styles from "./DropdownMenu.module.css";

export interface DropdownMenuItem {
  /** Stable identity, also used as the React key. */
  id: string;
  /** Visible label. */
  label: string;
  /** Optional leading icon, by name from the Flexar icon set. */
  icon?: IconName;
  /** Optional trailing icon — typically `"check"` to signal that
   *  the item is the currently-selected option in a radio-like
   *  group (e.g. the theme picker in the account menu). */
  trailing?: IconName;
  /** Renders the item in the danger colour role. */
  danger?: boolean;
  /** Greys the item out and makes it non-interactive. */
  disabled?: boolean;
  /** Invoked when the item is activated; the menu then closes. */
  onSelect: () => void;
}

/** A horizontal rule between groups of items. */
export interface DropdownMenuSeparator {
  /** Stable identity / React key. */
  id: string;
  separator: true;
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuSeparator;

export interface DropdownMenuProps {
  /** The trigger element — cloned by `Popover` (single focusable el). */
  trigger: ReactElement;
  /** Items and separators, in render order. */
  items: DropdownMenuEntry[];
  /** Side of the trigger the menu appears on. Defaults to `bottom`. */
  placement?: OverlayPlacement;
  /** Controlled open state. Provide together with `onOpenChange`. */
  open?: boolean;
  /** Notified whenever the open state should change. */
  onOpenChange?: (open: boolean) => void;
  /** Accessible label for the menu. */
  "aria-label"?: string;
}

function isSeparator(entry: DropdownMenuEntry): entry is DropdownMenuSeparator {
  return "separator" in entry;
}

export function DropdownMenu({
  trigger,
  items,
  placement = "bottom",
  open: controlledOpen,
  onOpenChange,
  "aria-label": ariaLabel = "Menu",
}: DropdownMenuProps): React.JSX.Element {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const listRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  // Indices (into `items`) of the enabled, selectable menu items.
  const enabledIndices = items.reduce<number[]>((acc, entry, index) => {
    if (!isSeparator(entry) && !entry.disabled) {
      acc.push(index);
    }
    return acc;
  }, []);

  const itemRefs = useRef(new Map<number, HTMLButtonElement>());

  const focusItemAt = useCallback((index: number) => {
    itemRefs.current.get(index)?.focus();
  }, []);

  const handleSelect = useCallback(
    (item: DropdownMenuItem) => {
      if (item.disabled) {
        return;
      }
      item.onSelect();
      setOpen(false);
    },
    [setOpen],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      if (enabledIndices.length === 0) {
        return;
      }
      const position = enabledIndices.indexOf(currentIndex);
      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const next = enabledIndices[(position + 1) % enabledIndices.length];
          focusItemAt(next);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prev =
            enabledIndices[
              (position - 1 + enabledIndices.length) % enabledIndices.length
            ];
          focusItemAt(prev);
          break;
        }
        case "Home": {
          event.preventDefault();
          focusItemAt(enabledIndices[0]);
          break;
        }
        case "End": {
          event.preventDefault();
          focusItemAt(enabledIndices[enabledIndices.length - 1]);
          break;
        }
        default:
          break;
      }
    },
    [enabledIndices, focusItemAt],
  );

  // Roving tabindex: the first enabled item is tabbable so Popover's
  // open-focus lands on it; the rest are reachable only via arrows.
  const firstEnabledIndex = enabledIndices[0];

  return (
    <Popover
      trigger={trigger}
      placement={placement}
      open={open}
      onOpenChange={setOpen}
      aria-label={ariaLabel}
      className={styles.panel}
    >
      <div ref={listRef} role="menu" aria-label={ariaLabel} className={styles.menu}>
        {items.map((entry, index) => {
          if (isSeparator(entry)) {
            return (
              <div key={entry.id} role="separator" className={styles.separator} />
            );
          }
          const itemClasses = [
            styles.item,
            entry.danger && styles.danger,
            entry.disabled && styles.disabled,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              ref={(node) => {
                if (node === null) {
                  itemRefs.current.delete(index);
                } else {
                  itemRefs.current.set(index, node);
                }
              }}
              className={itemClasses}
              disabled={entry.disabled}
              aria-disabled={entry.disabled || undefined}
              tabIndex={index === firstEnabledIndex ? 0 : -1}
              onClick={() => handleSelect(entry)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {entry.icon && (
                <span className={styles.itemIcon}>
                  <Icon name={entry.icon} size="sm" />
                </span>
              )}
              <span className={styles.itemLabel}>{entry.label}</span>
              {entry.trailing !== undefined && (
                <span className={styles.itemTrailing}>
                  <Icon name={entry.trailing} size="sm" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}

// Flexar Hub Web — Popover primitive (Phase 0.6, group D).
//
// A click-triggered floating panel anchored to a trigger element. The
// trigger is passed as `trigger` and cloned so Popover can attach a
// ref, an `onClick` toggle and `aria-expanded`/`aria-haspopup` without
// an extra wrapper. The panel is portaled to `document.body` and
// positioned with the shared `useOverlayPosition` helper.
//
// API — open state may be controlled or uncontrolled:
//   - Uncontrolled (default): Popover owns `open`; the trigger's click
//     toggles it. `defaultOpen` seeds the initial value.
//   - Controlled: pass `open` *and* `onOpenChange`; Popover never
//     mutates state itself, it only calls `onOpenChange`.
//
// Dismissal: outside pointer press and `Escape` (shared `useDismiss`).
// Focus: on open, focus moves to the first tabbable element in the
// panel (or the panel itself); on close it returns to the trigger.
//
// DropdownMenu builds on this component for its floating/dismissal/
// focus behaviour rather than reimplementing it.

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement } from "react";
import {
  Portal,
  getTabbableElements,
  useDismiss,
  useOverlayPosition,
} from "../_overlay";
import type { OverlayPlacement } from "../_overlay";
import styles from "./Popover.module.css";

export interface PopoverProps {
  /**
   * The trigger element. Cloned to receive a ref, a click toggle and
   * `aria-expanded`/`aria-haspopup`. Must be a single focusable
   * element.
   */
  trigger: ReactElement;
  /** Panel contents. */
  children: React.ReactNode;
  /** Side of the trigger the panel appears on. Defaults to `bottom`. */
  placement?: OverlayPlacement;
  /** Controlled open state. Provide together with `onOpenChange`. */
  open?: boolean;
  /** Initial open state in uncontrolled mode. Defaults to false. */
  defaultOpen?: boolean;
  /** Notified whenever the open state should change. */
  onOpenChange?: (open: boolean) => void;
  /** Accessible label for the panel (`role="dialog"`). */
  "aria-label"?: string;
  /** Extra class on the panel surface. */
  className?: string;
}

export function Popover({
  trigger,
  children,
  placement = "bottom",
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  "aria-label": ariaLabel,
  className,
}: PopoverProps): React.JSX.Element {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  // The anchor is tracked in state (not just a ref) so positioning
  // re-runs once the cloned trigger mounts — a bare ref mutation does
  // not trigger the render `useOverlayPosition` needs. `anchorRef`
  // mirrors it for `useDismiss` and focus restoration, which read
  // `.current` lazily and so are fine with a plain ref.
  const anchorRef = useRef<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const setAnchorRef = useCallback((node: HTMLElement | null) => {
    anchorRef.current = node;
    setAnchor(node);
  }, []);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const panelId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useOverlayPosition({
    anchor,
    floating: panel,
    placement,
    enabled: open,
  });

  useDismiss({
    enabled: open,
    overlayRef: panelRef,
    anchorRef,
    onDismiss: () => setOpen(false),
  });

  // Focus management: into the panel on open, back to the trigger on
  // close. The ref keeps the "should restore" intent across renders.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && panel !== null) {
      const tabbables = getTabbableElements(panel);
      if (tabbables.length > 0) {
        tabbables[0].focus();
      } else {
        panel.focus();
      }
      wasOpen.current = true;
    } else if (!open && wasOpen.current) {
      anchorRef.current?.focus();
      wasOpen.current = false;
    }
  }, [open, panel]);

  if (!isValidElement(trigger)) {
    throw new Error("Popover expects a single React element as `trigger`.");
  }

  const triggerProps = trigger.props as Record<string, unknown>;
  const triggerOnClick = triggerProps.onClick;

  const clonedTrigger = cloneElement(trigger, {
    ref: setAnchorRef,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": open ? panelId : undefined,
    onClick: (event: React.MouseEvent) => {
      if (typeof triggerOnClick === "function") {
        (triggerOnClick as (e: React.MouseEvent) => void)(event);
      }
      setOpen(!open);
    },
  } as Record<string, unknown>);

  return (
    <>
      {clonedTrigger}
      {open && (
        <Portal>
          <div
            ref={(node) => {
              panelRef.current = node;
              setPanel(node);
            }}
            id={panelId}
            role="dialog"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={[styles.panel, className].filter(Boolean).join(" ")}
          >
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

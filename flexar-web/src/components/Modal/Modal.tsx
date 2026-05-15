// Flexar Hub Web — Modal / Dialog primitive (Phase 0.6, group D).
//
// A centered modal dialog with a backdrop. Controlled only: the caller
// owns `open` and is notified via `onClose`. The dialog and backdrop
// are portaled to `document.body` so they sit above the app regardless
// of stacking context.
//
// Dismissal: backdrop press and `Escape`, each disable-able via
// `dismissable` (covers both; a simple single switch reads cleaner
// than two independent flags for this primitive).
//
// Focus: while open, focus is trapped within the dialog (`Tab` /
// `Shift+Tab` cycle, via the shared `createFocusTrapHandler`); on open
// focus moves to the first tabbable element (or the dialog itself), and
// on close it returns to the element that was focused before opening.
// Body scroll is locked while open.
//
// a11y: `role="dialog"`, `aria-modal="true"`, and — when a `title` is
// given — `aria-labelledby` pointing at the heading.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconButton } from "../IconButton";
import {
  Portal,
  createFocusTrapHandler,
  getTabbableElements,
} from "../_overlay";
import styles from "./Modal.module.css";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Whether the dialog is shown. Modal is controlled. */
  open: boolean;
  /** Called when the user requests to close (backdrop / `Escape` / X). */
  onClose: () => void;
  /** Optional heading; when set, wires `aria-labelledby`. */
  title?: string;
  /** Dialog body. */
  children: React.ReactNode;
  /** Footer slot, e.g. action buttons. */
  footer?: React.ReactNode;
  /** Max-width tier. Defaults to `md`. */
  size?: ModalSize;
  /**
   * When false, backdrop press and `Escape` no longer close the dialog
   * (the X button still does). Defaults to true.
   */
  dismissable?: boolean;
  /** Accessible label when there is no visible `title`. */
  "aria-label"?: string;
}

const sizeClass: Record<ModalSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  dismissable = true,
  "aria-label": ariaLabel,
}: ModalProps): React.JSX.Element | null {
  // The dialog node is tracked as state (not just a ref) so the
  // focus-on-open effect re-runs once the portaled element is actually
  // mounted in the DOM — the portal host attaches a tick after the
  // `open` change.
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Focus trap: cycle Tab within the dialog while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = createFocusTrapHandler(() => dialog);
    document.addEventListener("keydown", handler, true);
    return () => {
      document.removeEventListener("keydown", handler, true);
    };
  }, [open, dialog]);

  // Escape to close (when dismissable).
  useEffect(() => {
    if (!open || !dismissable) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, dismissable, onClose]);

  // Remember what had focus before opening, and restore it on close.
  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      previouslyFocused.current?.focus();
    };
  }, [open]);

  // Move focus into the dialog once it is mounted.
  useEffect(() => {
    if (!open || dialog === null) {
      return;
    }
    const tabbables = getTabbableElements(dialog);
    if (tabbables.length > 0) {
      tabbables[0].focus();
    } else {
      dialog.focus();
    }
  }, [open, dialog]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleBackdropClick = useCallback(() => {
    if (dismissable) {
      onClose();
    }
  }, [dismissable, onClose]);

  if (!open) {
    return null;
  }

  return (
    <Portal>
      <div className={styles.backdrop} onClick={handleBackdropClick}>
        <div
          ref={setDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          tabIndex={-1}
          className={[styles.dialog, sizeClass[size]].join(" ")}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.header}>
            {title && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            <span className={styles.closeSlot}>
              <IconButton
                icon="close"
                aria-label="Закрыть"
                variant="ghost"
                onClick={onClose}
              />
            </span>
          </div>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

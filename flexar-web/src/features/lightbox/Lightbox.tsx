// Image lightbox (Phase 4.2).
//
// Mounted once at the AppShell level. Renders a full-bleed image
// overlay when `useLightboxStore` is open. Click on the backdrop or
// the close button, or press `Escape`, to dismiss. The image itself
// does not dismiss when clicked — that lets a user scroll a tall
// image without accidentally closing it.
//
// Image opening is push-based: any `MessageContent` instance calls
// `useLightboxStore.openImage(src, alt)` and the lightbox renders
// it. No per-message wiring; one handler in the store.
//
// Focus management: focus moves to the close button on open; on close
// we let `MessageContent`'s natural flow restore focus (the user's
// click target is still in the DOM and re-focusable). The Portal +
// fixed positioning take the lightbox out of the tab order otherwise.

import { useEffect, useRef } from "react";
import { Portal } from "../../components/_overlay";
import { IconButton } from "../../components/IconButton";
import { useLightboxStore } from "./lightboxStore";
import styles from "./Lightbox.module.css";

export function Lightbox(): React.JSX.Element | null {
  const open = useLightboxStore((s) => s.open);
  const src = useLightboxStore((s) => s.src);
  const alt = useLightboxStore((s) => s.alt);
  const close = useLightboxStore((s) => s.close);

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Esc to close. Listen at the document level so the modal is
  // dismissable even when focus has slipped to the backdrop.
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, close]);

  // Focus the close button on open so a screen reader announces the
  // overlay and the keyboard user has an obvious dismiss target.
  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open || src === null) {
    return null;
  }

  // Backdrop click closes; image click does not bubble — without the
  // stop, dragging text-selection across a tall image would dismiss.
  const handleBackdropClick = (
    event: React.MouseEvent<HTMLDivElement>,
  ): void => {
    if (event.target === event.currentTarget) {
      close();
    }
  };

  return (
    <Portal>
      <div
        className={styles.backdrop}
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        onClick={handleBackdropClick}
      >
        <IconButton
          ref={closeButtonRef}
          icon="close"
          size="md"
          variant="ghost"
          aria-label="Close image preview"
          className={styles.closeButton}
          onClick={close}
        />
        <img className={styles.image} src={src} alt={alt} />
      </div>
    </Portal>
  );
}

// Flexar Hub Web — useDismiss (shared overlay helper, Phase 0.6,
// group D).
//
// Wires the two universal "close this overlay" gestures shared by
// Popover, DropdownMenu and Modal: pressing `Escape`, and a pointer
// press outside the overlay (and outside its anchor, so clicking the
// trigger does not immediately re-close). Each gesture can be disabled
// independently.

import { useEffect } from "react";

interface UseDismissArgs {
  /** When false, no listeners are attached. */
  enabled: boolean;
  /** The overlay surface; clicks inside it do not dismiss. */
  overlayRef: React.RefObject<HTMLElement | null>;
  /**
   * Optional anchor/trigger; clicks on it are ignored so the trigger's
   * own handler controls toggling.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
  onDismiss: () => void;
  /** Close on `Escape`. Defaults to true. */
  closeOnEscape?: boolean;
  /** Close on outside pointer press. Defaults to true. */
  closeOnOutsidePress?: boolean;
}

export function useDismiss({
  enabled,
  overlayRef,
  anchorRef,
  onDismiss,
  closeOnEscape = true,
  closeOnOutsidePress = true,
}: UseDismissArgs): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (closeOnEscape && event.key === "Escape") {
        event.stopPropagation();
        onDismiss();
      }
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!closeOnOutsidePress) {
        return;
      }
      const target = event.target as Node | null;
      if (target === null) {
        return;
      }
      if (overlayRef.current?.contains(target)) {
        return;
      }
      if (anchorRef?.current?.contains(target)) {
        return;
      }
      onDismiss();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [
    enabled,
    overlayRef,
    anchorRef,
    onDismiss,
    closeOnEscape,
    closeOnOutsidePress,
  ]);
}

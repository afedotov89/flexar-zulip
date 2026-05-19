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
  /**
   * Nested overlay panels that are logically "inside" this overlay
   * but live in a sibling portal in the DOM. Clicks inside any of
   * these are ignored so a child popover does not dismiss its
   * parent. The set is stored in a ref so additions/removals during
   * the overlay's lifetime are seen without re-running the effect.
   */
  descendantPanels?: React.RefObject<Set<React.RefObject<HTMLElement | null>>>;
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
  descendantPanels,
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
      // Treat nested overlay panels (siblings in the DOM but
      // logically inside this overlay) as part of this overlay's
      // surface. Without this a child popover's pointerdown would
      // dismiss its parent before the click ever reaches the
      // child's handler.
      const nested = descendantPanels?.current;
      if (nested !== undefined && nested !== null) {
        for (const panelRef of nested) {
          if (panelRef.current?.contains(target)) {
            return;
          }
        }
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
    descendantPanels,
    onDismiss,
    closeOnEscape,
    closeOnOutsidePress,
  ]);
}

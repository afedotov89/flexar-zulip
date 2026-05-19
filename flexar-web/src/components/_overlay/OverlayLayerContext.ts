// Flexar Hub Web — overlay-layer context for nested-popover dismissal.
//
// Why this exists: every Popover/DropdownMenu portals its panel to
// `document.body`, so a nested popover lives in the DOM as a sibling
// of its parent's panel — not a descendant. The parent's
// `useDismiss` therefore sees a pointerdown inside the nested panel
// as "outside" and closes itself, which makes nested popovers (e.g.
// the emoji picker inside the status editor) impossible to interact
// with without the parent vanishing mid-click.
//
// This context lets an open child overlay register its `panelRef`
// with the nearest parent overlay. The parent's `useDismiss` then
// treats clicks inside any registered descendant panel as
// non-dismissing — the same semantics as if the panels were
// DOM-nested.
//
// Each Popover both *provides* a layer (for its own descendants) and
// *consumes* the layer of the closest ancestor (so it can register
// itself).

import { createContext, useContext, useEffect, type RefObject } from "react";

export interface OverlayLayer {
  /**
   * Register a descendant panel so its rectangle is treated as part
   * of this layer for outside-press dismissal. Returns an unregister
   * function for cleanup on unmount or close.
   */
  register: (panelRef: RefObject<HTMLElement | null>) => () => void;
}

export const OverlayLayerContext = createContext<OverlayLayer | null>(null);

/**
 * Register an overlay panel with its nearest open ancestor overlay so
 * the ancestor does not dismiss when the user interacts inside this
 * panel. Safe to call when there is no ancestor (no-op).
 *
 * `enabled` should track the panel's open state — we only want to
 * register a panel that is actually mounted and visible, otherwise
 * the parent would keep a stale ref forever.
 */
export function useRegisterAsDescendant(
  panelRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  const parent = useContext(OverlayLayerContext);
  useEffect(() => {
    if (parent === null || !enabled) {
      return;
    }
    return parent.register(panelRef);
  }, [parent, panelRef, enabled]);
}

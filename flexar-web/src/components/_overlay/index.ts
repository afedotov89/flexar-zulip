// Flexar Hub Web — shared overlay helpers (Phase 0.6, group D).
//
// Internal to the overlay family (Tooltip, Popover, DropdownMenu,
// Modal). Not a public primitive — these are building blocks the four
// overlay components share to keep portaling, positioning, dismissal
// and focus management consistent.

export { Portal } from "./Portal";
export type { PortalProps } from "./Portal";
export { useOverlayPosition } from "./useOverlayPosition";
export type { OverlayPlacement } from "./useOverlayPosition";
export { useDismiss } from "./useDismiss";
export { getTabbableElements, createFocusTrapHandler } from "./focus";
export {
  OverlayLayerContext,
  useRegisterAsDescendant,
} from "./OverlayLayerContext";
export type { OverlayLayer } from "./OverlayLayerContext";

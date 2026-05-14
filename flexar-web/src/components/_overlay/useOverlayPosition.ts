// Flexar Hub Web — useOverlayPosition (shared overlay helper, Phase 0.6,
// group D).
//
// Computes a fixed-position placement for a floating element (Tooltip,
// Popover, DropdownMenu) relative to an anchor element, on one of four
// sides. The result is written to the floating element as the CSS
// custom properties `--overlay-x` / `--overlay-y` (consumed by the
// component's CSS Module).
//
// Why CSS custom properties set imperatively (via a ref), not the JSX
// `style` prop: the repo's ESLint config forbids the `style` prop
// outright (`react/forbid-dom-props`), including for custom properties.
// Setting properties imperatively through a ref in a layout effect is a
// distinct, lint-clean mechanism and is the standard approach for
// portal positioning. The values are pure computed geometry, not design
// tokens, so this does not violate the "tokens only" rule.
//
// jsdom note: `getBoundingClientRect` returns all-zero rects under the
// test environment, so positioning math resolves to 0/0 there. That is
// fine — tests must not assert on real geometry (see the guard in the
// task brief); behaviour (open/close, a11y) is what is tested.

import { useCallback, useLayoutEffect, useState } from "react";

export type OverlayPlacement = "top" | "bottom" | "left" | "right";

/** Gap between the anchor and the floating element, in pixels. */
const OFFSET = 8;

interface UseOverlayPositionArgs {
  anchor: HTMLElement | null;
  floating: HTMLElement | null;
  placement: OverlayPlacement;
  /** When false, no listeners are attached and no work is done. */
  enabled: boolean;
}

function computePosition(
  anchorRect: DOMRect,
  floatingRect: DOMRect,
  placement: OverlayPlacement,
): { x: number; y: number } {
  switch (placement) {
    case "top":
      return {
        x: anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2,
        y: anchorRect.top - floatingRect.height - OFFSET,
      };
    case "bottom":
      return {
        x: anchorRect.left + anchorRect.width / 2 - floatingRect.width / 2,
        y: anchorRect.bottom + OFFSET,
      };
    case "left":
      return {
        x: anchorRect.left - floatingRect.width - OFFSET,
        y: anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2,
      };
    case "right":
      return {
        x: anchorRect.right + OFFSET,
        y: anchorRect.top + anchorRect.height / 2 - floatingRect.height / 2,
      };
  }
}

/**
 * Positions `floating` against `anchor`. Recomputes on mount and on
 * window scroll/resize while `enabled`. Writes `--overlay-x` /
 * `--overlay-y` onto the floating element.
 */
export function useOverlayPosition({
  anchor,
  floating,
  placement,
  enabled,
}: UseOverlayPositionArgs): void {
  // Bumped to force the layout effect to re-run on scroll/resize.
  const [tick, setTick] = useState(0);

  const update = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useLayoutEffect(() => {
    if (!enabled || anchor === null || floating === null) {
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const floatingRect = floating.getBoundingClientRect();
    const { x, y } = computePosition(anchorRect, floatingRect, placement);
    floating.style.setProperty("--overlay-x", `${Math.round(x)}px`);
    floating.style.setProperty("--overlay-y", `${Math.round(y)}px`);
  }, [enabled, anchor, floating, placement, tick]);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [enabled, update]);
}

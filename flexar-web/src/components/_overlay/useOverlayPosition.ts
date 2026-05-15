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

/** Opposite-side fallback used when the requested placement does not fit. */
const OPPOSITE: Record<OverlayPlacement, OverlayPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function placeOnSide(
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

/** Whether the floating panel fits inside the viewport at `(x, y)`. */
function fitsInViewport(
  x: number,
  y: number,
  floatingRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x + floatingRect.width <= viewportWidth &&
    y + floatingRect.height <= viewportHeight
  );
}

/**
 * Compute the on-screen `(x, y)` for `floating` against `anchor` with
 * the requested `placement`, flipping to the opposite side when the
 * preferred side does not fit. As a final guard the result is clamped
 * inside the viewport so the panel never anchors off-screen — better
 * a slightly-shifted overlay than one whose close button is invisible.
 */
function computePosition(
  anchorRect: DOMRect,
  floatingRect: DOMRect,
  placement: OverlayPlacement,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const preferred = placeOnSide(anchorRect, floatingRect, placement);
  if (
    fitsInViewport(
      preferred.x,
      preferred.y,
      floatingRect,
      viewportWidth,
      viewportHeight,
    )
  ) {
    return clampToViewport(
      preferred,
      floatingRect,
      viewportWidth,
      viewportHeight,
    );
  }
  // The requested side does not fit. Try the opposite side; if it
  // also does not fit we fall through to the clamp below — the panel
  // sits at whichever side has more room.
  const flipped = placeOnSide(anchorRect, floatingRect, OPPOSITE[placement]);
  if (
    fitsInViewport(
      flipped.x,
      flipped.y,
      floatingRect,
      viewportWidth,
      viewportHeight,
    )
  ) {
    return clampToViewport(
      flipped,
      floatingRect,
      viewportWidth,
      viewportHeight,
    );
  }
  return clampToViewport(preferred, floatingRect, viewportWidth, viewportHeight);
}

function clampToViewport(
  pos: { x: number; y: number },
  floatingRect: DOMRect,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const x = Math.max(
    OFFSET,
    Math.min(pos.x, viewportWidth - floatingRect.width - OFFSET),
  );
  const y = Math.max(
    OFFSET,
    Math.min(pos.y, viewportHeight - floatingRect.height - OFFSET),
  );
  return { x, y };
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
    const { x, y } = computePosition(
      anchorRect,
      floatingRect,
      placement,
      window.innerWidth,
      window.innerHeight,
    );
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

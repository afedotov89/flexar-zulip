// Flexar Hub Web — focus utilities (shared overlay helper, Phase 0.6,
// group D).
//
// Focus-management primitives shared by the overlay family: collecting
// the tabbable elements inside a container, and a `keydown` handler
// factory that implements a focus trap (used by Modal — `Tab` / `Shift+
// Tab` cycle within the dialog). Popover/DropdownMenu reuse
// `getTabbableElements` for "move focus into the panel on open".

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Tabbable descendants of `container`, in DOM order. Filters out
 * elements that are not rendered (zero-size) — except under jsdom,
 * where every element reports zero size, so the filter is skipped.
 */
export function getTabbableElements(container: HTMLElement): HTMLElement[] {
  const all = Array.from(
    container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  );
  // jsdom gives every element a 0x0 box; don't filter there or we would
  // drop everything. `offsetParent` is null for `position: fixed`, so
  // rely on client rects instead, and treat an all-zero document as
  // jsdom.
  const anyVisible = all.some(
    (element) => element.getClientRects().length > 0,
  );
  if (!anyVisible) {
    return all;
  }
  return all.filter((element) => element.getClientRects().length > 0);
}

/**
 * Builds a `keydown` handler that traps `Tab` focus within `container`.
 * Wrapping past the last tabbable element returns to the first, and
 * vice versa. If the container has no tabbable children, focus is
 * pinned to the container itself.
 */
export function createFocusTrapHandler(
  getContainer: () => HTMLElement | null,
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    if (event.key !== "Tab") {
      return;
    }
    const container = getContainer();
    if (container === null) {
      return;
    }
    const tabbables = getTabbableElements(container);
    if (tabbables.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  };
}

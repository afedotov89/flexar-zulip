// Flexar Hub Web — Tooltip primitive (Phase 0.6, group D).
//
// A hover/focus-triggered text tip anchored to a single trigger
// element. The trigger is passed as `children` and cloned so the
// tooltip can attach a ref and the hover/focus handlers without an
// extra wrapper element. The tip itself is portaled to `document.body`
// (escaping `overflow`/stacking contexts) and positioned with the
// shared `useOverlayPosition` helper.
//
// Behaviour (uncontrolled — Tooltip owns its open state):
//   - opens on `mouseenter` and on keyboard `focus` of the trigger,
//   - closes on `mouseleave`, `blur` and `Escape`,
//   - `delay` (ms) debounces the *open* only; closing is immediate.
//
// a11y: the tip has `role="tooltip"` and a generated id; the trigger
// is linked to it via `aria-describedby`.

import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement } from "react";
import { Portal, useOverlayPosition } from "../_overlay";
import type { OverlayPlacement } from "../_overlay";
import styles from "./Tooltip.module.css";

export interface TooltipProps {
  /** Tip contents — plain text or rich nodes. */
  content: React.ReactNode;
  /**
   * The trigger element. Cloned to receive a ref and the hover/focus
   * handlers, so it must be a single focusable React element.
   */
  children: ReactElement;
  /** Side of the trigger the tip appears on. Defaults to `top`. */
  placement?: OverlayPlacement;
  /** Delay before the tip opens, in milliseconds. Defaults to 0. */
  delay?: number;
}

interface TriggerExtraProps {
  ref: React.Ref<HTMLElement>;
  "aria-describedby"?: string;
  onMouseEnter: (event: React.MouseEvent) => void;
  onMouseLeave: (event: React.MouseEvent) => void;
  onFocus: (event: React.FocusEvent) => void;
  onBlur: (event: React.FocusEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function Tooltip({
  content,
  children,
  placement = "top",
  delay = 0,
}: TooltipProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  // The anchor is tracked in state (not a ref) so positioning re-runs
  // once the cloned trigger mounts — a bare ref mutation would not
  // trigger the render `useOverlayPosition` depends on.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [tip, setTip] = useState<HTMLDivElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  useOverlayPosition({
    anchor,
    floating: tip,
    placement,
    enabled: open,
  });

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const show = useCallback(() => {
    if (delay > 0) {
      clearOpenTimer();
      openTimer.current = setTimeout(() => setOpen(true), delay);
    } else {
      setOpen(true);
    }
  }, [delay, clearOpenTimer]);

  const hide = useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);

  if (!isValidElement(children)) {
    throw new Error("Tooltip expects a single React element as children.");
  }

  // Preserve any handlers already on the trigger.
  const childProps = children.props as Record<string, unknown>;
  const callChild = <E,>(name: string, event: E): void => {
    const handler = childProps[name];
    if (typeof handler === "function") {
      (handler as (e: E) => void)(event);
    }
  };

  const triggerProps: TriggerExtraProps = {
    ref: setAnchor,
    "aria-describedby": open ? tooltipId : undefined,
    onMouseEnter: (event) => {
      callChild("onMouseEnter", event);
      show();
    },
    onMouseLeave: (event) => {
      callChild("onMouseLeave", event);
      hide();
    },
    onFocus: (event) => {
      callChild("onFocus", event);
      show();
    },
    onBlur: (event) => {
      callChild("onBlur", event);
      hide();
    },
    onKeyDown: (event) => {
      callChild("onKeyDown", event);
      if (event.key === "Escape") {
        hide();
      }
    },
  };

  return (
    <>
      {cloneElement(children, triggerProps)}
      {open && (
        <Portal>
          <div
            ref={setTip}
            id={tooltipId}
            role="tooltip"
            className={styles.tooltip}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}

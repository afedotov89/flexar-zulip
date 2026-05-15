// Flexar Hub Web — auto-growing textarea wrapper for compose (Phase 2.1).
//
// `Textarea` (the primitive) is intentionally minimal — height comes
// from `rows` and never grows with content. The compose box, on the
// other hand, must expand to fit the user's draft up to a sensible cap,
// then scroll. That auto-grow behaviour belongs to compose, not the
// primitive (other consumers of `Textarea` — settings forms, profile
// fields — want fixed heights). So this wrapper extends `Textarea` for
// the compose feature only, instead of widening the primitive's API.
//
// Implementation: on every value change (and once on mount), the
// element's `height` is reset to `auto` then set to its `scrollHeight`.
// The CSS Module gives the element a `min-height` (one row) and
// `max-height` (the cap, beyond which it scrolls) — both via tokens.
// The height write is layout, not a design value, so it is set as a
// CSS custom property (`--auto-height`) through a ref, consistent with
// the project-wide pattern that forbids the `style` prop.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { Textarea } from "../../components/Textarea";
import styles from "./AutoGrowTextarea.module.css";

export interface AutoGrowTextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "rows"
  > {
  /** Error state — forwarded to the underlying `Textarea`. */
  invalid?: boolean;
  /** Initial visible rows; the element grows beyond this with content. */
  minRows?: number;
}

export const AutoGrowTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoGrowTextareaProps
>(function AutoGrowTextarea(
  { invalid = false, minRows = 1, value, ...rest },
  forwardedRef,
): React.JSX.Element {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  // Forward the inner ref to the consumer (compose needs to call
  // `.focus()` after a successful send) without losing local access.
  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

  // Resize on every value change. We reset to `auto` first so shrinking
  // works — `scrollHeight` only grows otherwise.
  useEffect(() => {
    const node = innerRef.current;
    if (node === null) {
      return;
    }
    node.style.setProperty("--auto-height", "auto");
    // Force layout, then read scrollHeight, then commit.
    const measured = node.scrollHeight;
    node.style.setProperty("--auto-height", `${measured}px`);
  }, [value]);

  return (
    <Textarea
      ref={innerRef}
      className={styles.autogrow}
      invalid={invalid}
      rows={minRows}
      value={value}
      {...rest}
    />
  );
});

AutoGrowTextarea.displayName = "AutoGrowTextarea";

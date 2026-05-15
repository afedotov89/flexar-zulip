// Flexar Hub Web — auto-growing textarea wrapper for the edit form (Phase 3.3).
//
// The edit form needs the same auto-grow behaviour `compose/` already
// owns (`compose/AutoGrowTextarea`), but importing across features
// would couple `messageActions/` to `compose/`'s internals. The
// auto-grow logic is also small (a single layout effect) and the
// alternative — promoting `AutoGrowTextarea` into `src/components/` —
// is out of scope for Phase 3.3 (touching shared primitives requires
// orchestrator approval). So we inline a small, identically-behaved
// variant here. If a third caller appears, this is the prompt to
// promote it through the orchestrator.
//
// Mechanics: on every value change, the inner `<textarea>` is reset to
// `auto` then resized to its `scrollHeight`, written to the
// `--auto-height` CSS custom property (not the `style` prop, which the
// project lints against). The CSS Module clamps it between a min and
// max via tokens.

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { Textarea } from "../../components/Textarea";
import styles from "./EditAutoGrowTextarea.module.css";

export interface EditAutoGrowTextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "className" | "rows"
  > {
  /** Error state — forwarded to the underlying `Textarea`. */
  invalid?: boolean;
  /** Initial visible rows; the element grows beyond this with content. */
  minRows?: number;
}

export const EditAutoGrowTextarea = forwardRef<
  HTMLTextAreaElement,
  EditAutoGrowTextareaProps
>(function EditAutoGrowTextarea(
  { invalid = false, minRows = 2, value, ...rest },
  forwardedRef,
): React.JSX.Element {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    forwardedRef,
    () => innerRef.current as HTMLTextAreaElement,
  );

  useEffect(() => {
    const node = innerRef.current;
    if (node === null) {
      return;
    }
    node.style.setProperty("--auto-height", "auto");
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

EditAutoGrowTextarea.displayName = "EditAutoGrowTextarea";

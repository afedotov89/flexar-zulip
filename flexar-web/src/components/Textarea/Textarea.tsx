// Flexar Hub Web — Textarea primitive (Phase 0.6).
//
// Multi-line text field wrapping the native <textarea>. Shares the
// border, radius and focus-ring treatment with Input so the two read as
// one family. Height is driven by the native `rows` attribute (default
// 3) — auto-resize is intentionally out of scope to keep the primitive
// minimal.
//
// States covered: hover, focus-visible, disabled, invalid. The `invalid`
// flag also sets `aria-invalid`.

import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  /** Error state — adds the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { invalid = false, disabled = false, rows = 3, className, ...rest },
    ref,
  ): React.JSX.Element {
    const classes = [styles.textarea, invalid && styles.invalid, className]
      .filter(Boolean)
      .join(" ");

    return (
      <textarea
        ref={ref}
        className={classes}
        disabled={disabled}
        rows={rows}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

Textarea.displayName = "Textarea";

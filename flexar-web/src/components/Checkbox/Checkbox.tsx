// Flexar Hub Web — Checkbox primitive (Phase 0.6).
//
// Semantic <input type="checkbox"> visually replaced with a styled box.
// The real input stays in the DOM (visually hidden, not removed) so
// keyboard operation, form submission and assistive tech all work for
// free; the styled box is a sibling driven by the input's `:checked`
// and `:focus-visible` states.
//
// The `indeterminate` flag has no HTML attribute — it is an IDL
// property — so it is applied to the input element via a ref effect.
//
// States covered: hover, focus-visible, checked, indeterminate,
// disabled, invalid. The `invalid` flag also sets `aria-invalid`.

import { forwardRef, useEffect, useId, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Icon } from "../Icon";
import styles from "./Checkbox.module.css";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  /** Optional text label rendered next to the box and tied to the input. */
  label?: string;
  /** Mixed state — shows a dash instead of a check. Purely visual/ARIA. */
  indeterminate?: boolean;
  /** Error state — adds the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      indeterminate = false,
      invalid = false,
      disabled = false,
      id,
      className,
      ...rest
    },
    forwardedRef,
  ): React.JSX.Element {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    // Internal ref drives the `indeterminate` IDL property; the
    // callback ref below keeps it in sync with the forwarded ref so
    // both the internal effect and external consumers see the input.
    const inputRef = useRef<HTMLInputElement | null>(null);

    const setInputRef = (node: HTMLInputElement | null): void => {
      inputRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef !== null) {
        forwardedRef.current = node;
      }
    };

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const rootClasses = [
      styles.root,
      disabled && styles.disabled,
      invalid && styles.invalid,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span className={rootClasses}>
        <span className={styles.control}>
          <input
            ref={setInputRef}
            id={inputId}
            type="checkbox"
            className={styles.input}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            {...rest}
          />
          <span className={styles.box} aria-hidden="true">
            {indeterminate ? (
              <span className={styles.dash} />
            ) : (
              <Icon name="check" size="sm" className={styles.mark} />
            )}
          </span>
        </span>
        {label !== undefined && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
      </span>
    );
  },
);

Checkbox.displayName = "Checkbox";

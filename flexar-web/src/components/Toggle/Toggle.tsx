// Flexar Hub Web — Toggle primitive (Phase 0.6).
//
// On/off switch built on a semantic <input type="checkbox"> with
// `role="switch"`. The checkbox is the accessible, keyboard-operable,
// form-friendly choice; `role="switch"` makes assistive tech announce
// it as a switch rather than a checkbox. The real input stays in the
// DOM (visually hidden) and the styled track + sliding knob are
// siblings driven by its `:checked` / `:focus-visible` states.
//
// `size` is a subset of Button's vocabulary — `sm | md`. A switch has
// no `lg` analogue in the design system, so the union is narrowed
// rather than redefined.
//
// States covered: hover, focus-visible, checked, disabled.

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import type { ButtonSize } from "../Button";
import styles from "./Toggle.module.css";

export type ToggleSize = Extract<ButtonSize, "sm" | "md">;

export interface ToggleProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "className" | "type" | "size" | "role"
  > {
  /** Text label rendered next to the switch and tied to the input. */
  label: string;
  /** Track footprint. Defaults to `md`. */
  size?: ToggleSize;
  className?: string;
}

const sizeClass: Record<ToggleSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(function Toggle(
  { label, size = "md", disabled = false, id, className, ...rest },
  ref,
): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const rootClasses = [
    styles.root,
    sizeClass[size],
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={rootClasses}>
      <span className={styles.control}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          className={styles.input}
          disabled={disabled}
          {...rest}
        />
        <span className={styles.track} aria-hidden="true">
          <span className={styles.knob} />
        </span>
      </span>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
    </span>
  );
});

Toggle.displayName = "Toggle";

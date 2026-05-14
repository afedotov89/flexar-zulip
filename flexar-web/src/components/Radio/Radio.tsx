// Flexar Hub Web — Radio primitive (Phase 0.6).
//
// Semantic <input type="radio"> visually replaced with a styled dot.
// Like Checkbox, the real input stays in the DOM (visually hidden) so
// keyboard arrow-key grouping, form submission and assistive tech work
// for free; the styled circle is a sibling driven by `:checked` and
// `:focus-visible`.
//
// No RadioGroup wrapper is provided: native radios already group by a
// shared `name`, and a thin wrapper would not earn its keep. Callers
// give each Radio the same `name` and distinct `value`.
//
// States covered: hover, focus-visible, checked, disabled, invalid.

import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./Radio.module.css";

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  /** Text label rendered next to the dot and tied to the input. */
  label: string;
  /** Radio group name — shared across the options of one group. */
  name: string;
  /** This option's submitted value. */
  value: string;
  /** Error state — adds the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  className?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    label,
    name,
    value,
    invalid = false,
    disabled = false,
    id,
    className,
    ...rest
  },
  ref,
): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;

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
          ref={ref}
          id={inputId}
          type="radio"
          name={name}
          value={value}
          className={styles.input}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          {...rest}
        />
        <span className={styles.circle} aria-hidden="true">
          <span className={styles.dot} />
        </span>
      </span>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
    </span>
  );
});

Radio.displayName = "Radio";

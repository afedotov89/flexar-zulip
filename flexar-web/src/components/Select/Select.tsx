// Flexar Hub Web — Select primitive (Phase 0.6).
//
// Styled native <select>. A native select (not a custom listbox popover)
// is the deliberate minimal choice: it is accessible and keyboard-
// operable for free. The browser's default dropdown arrow is removed via
// `appearance: none` and replaced with the `chevron-down` Icon so the
// affordance matches the rest of the icon set.
//
// Options come in as a typed array; rendering <option> children would
// also work but the array keeps callers declarative and the markup
// owned by the primitive.
//
// States covered: hover, focus-visible, disabled, invalid. The `invalid`
// flag also sets `aria-invalid`.

import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import type { ButtonSize } from "../Button";
import { Icon } from "../Icon";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "size"> {
  /** Control height, from `--control-height-*`. Defaults to `md`. */
  size?: ButtonSize;
  /** Error state — adds the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  /** The choices rendered as <option> elements. */
  options: SelectOption[];
  /** Optional non-selectable hint shown as the first, empty option. */
  placeholder?: string;
  className?: string;
}

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

const iconSizeForControl: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = "md",
    invalid = false,
    disabled = false,
    options,
    placeholder,
    className,
    ...rest
  },
  ref,
): React.JSX.Element {
  const wrapperClasses = [
    styles.wrapper,
    sizeClass[size],
    invalid && styles.invalid,
    disabled && styles.disabled,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={wrapperClasses}>
      <select
        ref={ref}
        className={styles.select}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={iconSizeForControl[size]}
        className={styles.chevron}
      />
    </span>
  );
});

Select.displayName = "Select";

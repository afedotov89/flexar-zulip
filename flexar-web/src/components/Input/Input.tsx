// Flexar Hub Web — Input primitive (Phase 0.6).
//
// Single-line text input wrapping the native <input>. Shares the control
// vocabulary with Button: `size` maps to `--control-height-*`, corners
// to `--radius-md`, borders/focus ring to the same colour roles. Optional
// leading/trailing icons are given by name — Input renders the `Icon`
// primitive itself.
//
// States covered: hover, focus-visible, disabled, invalid. The `invalid`
// flag also sets `aria-invalid` so assistive tech is informed.

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import type { IconName } from "../../icons";
import type { ButtonSize } from "../Button";
import { Icon } from "../Icon";
import styles from "./Input.module.css";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> {
  /** Control height, from `--control-height-*`. Defaults to `md`. */
  size?: ButtonSize;
  /** Error state — adds the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  /** Icon name rendered inside the field, before the text. */
  iconLeft?: IconName;
  /** Icon name rendered inside the field, after the text. */
  iconRight?: IconName;
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

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    invalid = false,
    disabled = false,
    iconLeft,
    iconRight,
    type = "text",
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

  const iconSize = iconSizeForControl[size];

  return (
    <span className={wrapperClasses}>
      {iconLeft && (
        <Icon name={iconLeft} size={iconSize} className={styles.iconLeft} />
      )}
      <input
        ref={ref}
        type={type}
        className={styles.input}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {iconRight && (
        <Icon name={iconRight} size={iconSize} className={styles.iconRight} />
      )}
    </span>
  );
});

Input.displayName = "Input";

// Flexar Hub Web — Button primitive (Phase 0.6).
//
// Semantic <button> with the shared control vocabulary used across the
// component library: `variant` (primary | secondary | ghost | danger)
// and `size` (sm | md | lg, mapped to `--control-height-*`). Optional
// leading/trailing icons are given by icon name — Button renders the
// `Icon` primitive itself, so callers never construct SVG markup.
//
// States covered: hover, focus-visible, active, disabled, loading. When
// `loading` is set the button is disabled and a `Spinner` replaces the
// icon affordance while the label stays in place (stable width).

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { IconName } from "../../icons";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /** Visual treatment. Defaults to `primary`. */
  variant?: ButtonVariant;
  /** Control height, from `--control-height-*`. Defaults to `md`. */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon name rendered before the label. */
  iconLeft?: IconName;
  /** Icon name rendered after the label. */
  iconRight?: IconName;
  /** Stretches the button to the full width of its container. */
  fullWidth?: boolean;
  className?: string;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

const iconSizeForButton: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    fullWidth = false,
    disabled = false,
    type = "button",
    children,
    className,
    ...rest
  },
  ref,
): React.JSX.Element {
  const classes = [
    styles.button,
    variantClass[variant],
    sizeClass[size],
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconSize = iconSizeForButton[size];

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className={styles.spinnerSlot}>
          <Spinner size={iconSize} />
        </span>
      )}
      {!loading && iconLeft && <Icon name={iconLeft} size={iconSize} />}
      {children != null && <span className={styles.label}>{children}</span>}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
});

Button.displayName = "Button";

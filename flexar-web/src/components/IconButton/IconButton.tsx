// Flexar Hub Web — IconButton primitive (Phase 0.6).
//
// Icon-only button. Shares the `variant` / `size` vocabulary with
// `Button` (primary | secondary | ghost | danger; sm | md | lg) but has
// a square footprint sized to `--control-height-*`. An `aria-label` is
// required since there is no visible text label.
//
// States covered: hover, focus-visible, active, disabled, loading. When
// `loading` is set the button is disabled and a `Spinner` replaces the
// icon.

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { IconName } from "../../icons";
import type { ButtonSize, ButtonVariant } from "../Button";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import styles from "./IconButton.module.css";

export interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "aria-label" | "children"
  > {
  /** Icon name from the Flexar icon set. */
  icon: IconName;
  /** Required: the button has no visible text label. */
  "aria-label": string;
  /** Visual treatment. Defaults to `secondary`. */
  variant?: ButtonVariant;
  /** Square footprint, from `--control-height-*`. Defaults to `md`. */
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
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
  md: "md",
  lg: "md",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      "aria-label": ariaLabel,
      variant = "secondary",
      size = "md",
      loading = false,
      disabled = false,
      type = "button",
      className,
      ...rest
    },
    ref,
  ): React.JSX.Element {
    const classes = [
      styles.iconButton,
      variantClass[variant],
      sizeClass[size],
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
        aria-label={ariaLabel}
        {...rest}
      >
        {loading ? (
          <Spinner size={iconSize} aria-label={ariaLabel} />
        ) : (
          <Icon name={icon} size={iconSize} />
        )}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";

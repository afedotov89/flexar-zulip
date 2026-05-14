// Flexar Hub Web — Badge / Counter primitive (Phase 0.6).
//
// Small pill for a count or a short label. Two mutually-exclusive
// content modes:
//   - `count` (+ optional `max`): the unread-counter use case. A count
//     above `max` renders as `"<max>+"` (e.g. `99+`).
//   - `children`: an arbitrary short label.
// `count` takes precedence when both are supplied.
//
// `variant` maps to token colour roles: `neutral` (muted surface),
// `accent` (brand), `danger`. Pill shape via `--radius-full`.

import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "neutral" | "accent" | "danger";

export interface BadgeProps {
  /** Colour treatment. Defaults to `neutral`. */
  variant?: BadgeVariant;
  /**
   * Numeric count. Renders `"<max>+"` when above `max`. Takes
   * precedence over `children` when both are given.
   */
  count?: number;
  /** Cap for `count`; values above it render as `"<max>+"`. */
  max?: number;
  /** Label content, used when `count` is not provided. */
  children?: ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  neutral: styles.neutral,
  accent: styles.accent,
  danger: styles.danger,
};

export function Badge({
  variant = "neutral",
  count,
  max,
  children,
  className,
}: BadgeProps): React.JSX.Element {
  const classes = [styles.badge, variantClass[variant], className]
    .filter(Boolean)
    .join(" ");

  let content: ReactNode = children;
  if (count != null) {
    content = max != null && count > max ? `${max}+` : `${count}`;
  }

  return <span className={classes}>{content}</span>;
}

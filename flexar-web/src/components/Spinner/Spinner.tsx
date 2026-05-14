// Flexar Hub Web — Spinner primitive (Phase 0.6).
//
// Indeterminate loading indicator: a rotating ring drawn with
// `currentColor`, so it inherits the surrounding text colour (this lets
// `Button` drop a Spinner into any variant without extra wiring). Size
// is token-driven and tracks the type scale, matching `Icon`.
//
// Exposes `role="status"` with an accessible label so screen readers
// announce the loading state; the label text itself is visually hidden.

import styles from "./Spinner.module.css";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  /** Token-driven footprint. Defaults to `md`. */
  size?: SpinnerSize;
  /** Accessible status label. Defaults to `"Loading"`. */
  "aria-label"?: string;
  className?: string;
}

const sizeClass: Record<SpinnerSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function Spinner({
  size = "md",
  "aria-label": ariaLabel = "Loading",
  className,
}: SpinnerProps): React.JSX.Element {
  const classes = [styles.spinner, sizeClass[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="status">
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.label}>{ariaLabel}</span>
    </span>
  );
}

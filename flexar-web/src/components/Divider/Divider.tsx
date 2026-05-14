// Flexar Hub Web — Divider primitive (Phase 0.6).
//
// A thin separator line. Horizontal dividers render a semantic <hr>;
// vertical dividers render a <div role="separator" aria-orientation>
// since <hr> has no meaningful vertical layout. The optional `spacing`
// prop adds symmetric token-driven margin along the divider's main
// axis (block margin for horizontal, inline margin for vertical).

import styles from "./Divider.module.css";

export type DividerOrientation = "horizontal" | "vertical";
export type DividerSpacing = "none" | "sm" | "md" | "lg";

export interface DividerProps {
  /** Line direction. Defaults to `horizontal`. */
  orientation?: DividerOrientation;
  /** Symmetric margin along the divider's main axis. Defaults to `none`. */
  spacing?: DividerSpacing;
  className?: string;
}

const spacingClass: Record<DividerSpacing, string | false> = {
  none: false,
  sm: styles.spacingSm,
  md: styles.spacingMd,
  lg: styles.spacingLg,
};

export function Divider({
  orientation = "horizontal",
  spacing = "none",
  className,
}: DividerProps): React.JSX.Element {
  const classes = [
    styles.divider,
    orientation === "vertical" ? styles.vertical : styles.horizontal,
    spacingClass[spacing],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (orientation === "vertical") {
    return (
      <div className={classes} role="separator" aria-orientation="vertical" />
    );
  }

  return <hr className={classes} />;
}

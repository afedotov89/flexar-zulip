// Flexar Hub Web — Skeleton primitive (Phase 0.6).
//
// Loading placeholder with a subtle pulse animation. Three variants:
// `text` (a line whose height tracks the type scale), `rect` (a block,
// e.g. a card or thumbnail) and `circle` (e.g. an avatar placeholder).
//
// Dimensions are token-driven preset keys rather than free-form values:
// the ENGINEERING_GUIDE forbids inline `style`, and presets keep
// skeletons in the design-system rhythm. `width` also accepts `"full"`
// (stretch to the container) which is the common case for text rows.
// Always `aria-hidden` — a skeleton is a visual placeholder only; the
// surrounding region should carry the real loading semantics.

import styles from "./Skeleton.module.css";

export type SkeletonVariant = "text" | "rect" | "circle";
export type SkeletonWidth = "full" | "sm" | "md" | "lg";
export type SkeletonSize = "sm" | "md" | "lg";

export interface SkeletonProps {
  /** Shape. Defaults to `text`. */
  variant?: SkeletonVariant;
  /**
   * Width preset. `full` stretches to the container. Defaults to `full`
   * for `text`/`rect` and is ignored for `circle` (sized by `height`).
   */
  width?: SkeletonWidth;
  /**
   * Height preset. For `text` it tracks the type scale; for `rect` it
   * is a block height; for `circle` it sets the diameter. Defaults to
   * `md`.
   */
  height?: SkeletonSize;
  className?: string;
}

const widthClass: Record<SkeletonWidth, string> = {
  full: styles.widthFull,
  sm: styles.widthSm,
  md: styles.widthMd,
  lg: styles.widthLg,
};

const heightClass: Record<SkeletonSize, string> = {
  sm: styles.heightSm,
  md: styles.heightMd,
  lg: styles.heightLg,
};

const variantClass: Record<SkeletonVariant, string> = {
  text: styles.text,
  rect: styles.rect,
  circle: styles.circle,
};

export function Skeleton({
  variant = "text",
  width = "full",
  height = "md",
  className,
}: SkeletonProps): React.JSX.Element {
  const classes = [
    styles.skeleton,
    variantClass[variant],
    // a circle's width is driven by its height (diameter), so the
    // width preset is only meaningful for text/rect.
    variant === "circle" ? false : widthClass[width],
    heightClass[height],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes} aria-hidden="true" />;
}

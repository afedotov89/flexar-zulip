// Flexar Hub Web — Icon primitive (Phase 0.6).
//
// Renders one icon from Flexar Hub's own icon set (`src/icons/`) as an
// inline SVG. Stroke-based: the SVG uses `currentColor` for stroke, so
// an icon inherits the surrounding text colour. Icons are decorative by
// default (`aria-hidden`); pass `aria-label` to expose one to assistive
// tech (the wrapper then becomes `role="img"`).

import type { IconName } from "../../icons";
import { icons } from "../../icons";
import styles from "./Icon.module.css";

export type IconSize = "sm" | "md" | "lg";

export interface IconProps {
  /** Which icon to render — union of the names in the Flexar icon set. */
  name: IconName;
  /** Token-driven footprint. Defaults to `md`. */
  size?: IconSize;
  /**
   * Accessible label. When given, the icon is exposed as `role="img"`;
   * when omitted, the icon is `aria-hidden` (decorative).
   */
  "aria-label"?: string;
  className?: string;
}

const sizeClass: Record<IconSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function Icon({
  name,
  size = "md",
  "aria-label": ariaLabel,
  className,
}: IconProps): React.JSX.Element {
  const classes = [styles.icon, sizeClass[size], className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}

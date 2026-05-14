// Flexar Hub Web — ScrollArea primitive (Phase 0.6).
//
// A thin styled scroll container: native `overflow: auto` plus
// consistent, theme-aware scrollbar styling driven by tokens. It is
// deliberately minimal — there is no custom JS-driven scrollbar.
//
// `orientation` picks which axis scrolls (`vertical` default,
// `horizontal`, or `both`). The container is keyboard-focusable so it
// can be scrolled with the arrow keys when it holds non-focusable
// content; a visible `:focus-visible` ring marks it.

import type { ReactNode } from "react";
import styles from "./ScrollArea.module.css";

export type ScrollOrientation = "vertical" | "horizontal" | "both";

export interface ScrollAreaProps {
  /** Content to scroll. */
  children: ReactNode;
  /** Which axis scrolls. Defaults to `vertical`. */
  orientation?: ScrollOrientation;
  className?: string;
}

const orientationClass: Record<ScrollOrientation, string> = {
  vertical: styles.vertical,
  horizontal: styles.horizontal,
  both: styles.both,
};

export function ScrollArea({
  children,
  orientation = "vertical",
  className,
}: ScrollAreaProps): React.JSX.Element {
  const classes = [styles.scrollArea, orientationClass[orientation], className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} tabIndex={0}>
      {children}
    </div>
  );
}

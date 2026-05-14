// A single navigation row in the left sidebar (Phase 1.5).
//
// Used for built-in views, DM conversations, channels, and topics — a
// leading slot (icon / avatar / spacer), a truncating label, and an
// optional trailing unread badge. It is a real anchor: navigation in
// this app is URL-driven, so a row is an `<a href>` the router
// intercepts, which also gives free middle-click / open-in-new-tab and
// correct keyboard semantics. The active row carries `aria-current`.
//
// Channel-color accent: a channel row passes `accentColor`, a value
// that comes from store data (the user's per-channel `Subscription
// .color`), not from the design-token system. Per ENGINEERING_GUIDE it
// must not be a hardcoded design value and must not be an inline
// `style` for a *token* — but a data-driven content color is neither.
// Following the pattern the `_overlay` helpers established for
// `--overlay-x/-y`, the value is written to a CSS custom property
// (`--nav-row-accent`) imperatively through a ref, and the stylesheet
// consumes `var(--nav-row-accent)`. No design value is hardcoded and no
// JSX `style` attribute is used.

import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/Badge";
import styles from "./NavRow.module.css";

export interface NavRowProps {
  /** Destination path; the router intercepts the anchor navigation. */
  to: string;
  /** The row's text label. Truncates with an ellipsis when too long. */
  label: string;
  /** Leading visual: an icon, an avatar, or a spacer for alignment. */
  leading?: ReactNode;
  /** Unread message count; a badge shows only when this is positive. */
  unreadCount?: number;
  /** Whether this row is the currently-active view/narrow. */
  selected?: boolean;
  /**
   * Indentation depth: `0` for top-level rows, `1` for nested rows
   * (topics under a channel). Drives a left-padding step.
   */
  indent?: 0 | 1;
  /**
   * Optional content color from store data (a channel's subscription
   * color). Written to a CSS custom property via ref — see the file
   * header. `undefined` leaves the property unset.
   */
  accentColor?: string;
  /** Accessible name for the unread badge, e.g. "3 unread messages". */
  unreadLabel?: string;
}

export function NavRow({
  to,
  label,
  leading,
  unreadCount = 0,
  selected = false,
  indent = 0,
  accentColor,
  unreadLabel,
}: NavRowProps): React.JSX.Element {
  const ref = useRef<HTMLAnchorElement>(null);

  // Write the data-driven accent color to a CSS custom property rather
  // than a JSX `style` attribute (see the file header for why).
  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    if (accentColor !== undefined) {
      node.style.setProperty("--nav-row-accent", accentColor);
    } else {
      node.style.removeProperty("--nav-row-accent");
    }
  }, [accentColor]);

  const classes = [
    styles.row,
    indent === 1 ? styles.indent : undefined,
    selected ? styles.selected : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      ref={ref}
      to={to}
      className={classes}
      aria-current={selected ? "page" : undefined}
    >
      <span className={styles.leading}>{leading}</span>
      <span className={styles.label}>{label}</span>
      {unreadCount > 0 && (
        <span className={styles.badge} aria-label={unreadLabel}>
          <Badge variant="neutral" count={unreadCount} max={99} />
        </span>
      )}
    </Link>
  );
}

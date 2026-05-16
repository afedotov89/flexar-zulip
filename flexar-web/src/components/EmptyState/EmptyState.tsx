// Flexar Hub Web — EmptyState primitive (Phase 6.7).
//
// Centered "nothing to see here" / "couldn't load this" panel used in
// place of bespoke per-feature empty layouts. Previously every feature
// rolled its own `<div class="empty">` with subtly-different paddings,
// font weights, and copy hierarchies. This unifies the look so an
// empty channel browser, an empty drafts page, a search with no
// matches, and an error-after-fetch all read the same.
//
// Three tones:
//   "empty"  — neutral. No results, no data yet.
//   "error"  — recoverable failure. Pairs with an `action` slot to
//              re-fetch / retry.
//   "muted"  — for inline sub-sections (sidebar lists) where the
//              panel sits inside a denser surrounding context.
//
// The component is presentational; the caller owns the strings and
// any retry action.

import type { ReactNode } from "react";
import type { IconName } from "../../icons";
import { Icon } from "../Icon";
import styles from "./EmptyState.module.css";

export type EmptyStateTone = "empty" | "error" | "muted";

export interface EmptyStateProps {
  /** Visual tone — drives colour and spacing density. */
  tone?: EmptyStateTone;
  /** Optional leading icon. Renders only when set. */
  icon?: IconName;
  /** Title line (heading style). */
  title: string;
  /** Optional secondary line under the title. */
  description?: ReactNode;
  /** Optional action slot — a button, a link, etc. */
  action?: ReactNode;
  className?: string;
}

const toneClass: Record<EmptyStateTone, string> = {
  empty: styles.empty,
  error: styles.error,
  muted: styles.muted,
};

export function EmptyState({
  tone = "empty",
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.JSX.Element {
  const classes = [styles.root, toneClass[tone], className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role={tone === "error" ? "alert" : "status"}>
      {icon && (
        <span className={styles.iconSlot} aria-hidden="true">
          <Icon name={icon} size="lg" />
        </span>
      )}
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

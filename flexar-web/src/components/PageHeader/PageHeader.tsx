// Flexar Hub Web — shared page header primitive.
//
// Sticky chrome at the top of a centre-column page: leading icon,
// primary title, optional `›`-separated secondary segment (used by
// the message feed's narrow summary for `channel › topic`).
//
// Consumed by every screen that names itself at the top of the
// centre column — `MessageFeed` (via `NarrowHeader`), `Recent`,
// `Inbox`, etc. Centralising the sticky-band chrome here means the
// visual contract (height, background, border-bottom, font weight)
// stays consistent across the whole app instead of drifting in each
// page's local CSS.

import { Icon } from "../Icon";
import type { IconName } from "../../icons";
import styles from "./PageHeader.module.css";

export interface PageHeaderProps {
  /** Leading icon, by name from the Flexar icon set. */
  icon: IconName;
  /** Primary label shown next to the icon. */
  title: string;
  /**
   * Optional secondary segment, rendered after a `›` separator.
   * Used by the message-feed narrow summary for topic breadcrumbs
   * (`channel › topic`); other pages typically leave this empty.
   */
  subtitle?: string;
}

export function PageHeader({
  icon,
  title,
  subtitle,
}: PageHeaderProps): React.JSX.Element {
  // `<div>`, not `<header>` — the AppShell's navbar already exposes
  // the page banner via `role="banner"`, and a duplicate landmark
  // would surface to assistive tech (this was a regression caught
  // in an early AppShell test). The visible affordance — sticky
  // chrome naming the view — is the same either way.
  return (
    <div className={styles.header}>
      <Icon name={icon} size="sm" className={styles.icon} />
      <span className={styles.primary}>{title}</span>
      {subtitle !== undefined && (
        <>
          <span className={styles.separator} aria-hidden="true">
            ›
          </span>
          <span className={styles.secondary}>{subtitle}</span>
        </>
      )}
    </div>
  );
}

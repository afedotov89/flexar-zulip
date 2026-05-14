// A collapsible section of the left sidebar (Phase 1.5).
//
// VIEWS / Direct messages / Channels each render as a `SidebarSection`:
// a header row that toggles the section open/closed, an optional
// trailing action slot in the header (e.g. the channels "+" button),
// and the section body which is hidden when collapsed.
//
// The header is a real `<button>` carrying `aria-expanded`; the body it
// controls is referenced via `aria-controls`. A trailing action lives
// *outside* the toggle button (a button cannot nest a button) but
// inside the header row, so the header reads as one strip.

import { useId, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import styles from "./SidebarSection.module.css";

export interface SidebarSectionProps {
  /** Section title, shown uppercased in the header. */
  title: string;
  /** Whether the section body is currently expanded. */
  expanded: boolean;
  /** Toggle the expanded state. */
  onToggle: () => void;
  /** Optional trailing control in the header (e.g. an add button). */
  headerAction?: ReactNode;
  /** The section content, rendered only while expanded. */
  children: ReactNode;
}

export function SidebarSection({
  title,
  expanded,
  onToggle,
  headerAction,
  children,
}: SidebarSectionProps): React.JSX.Element {
  const bodyId = useId();
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <Icon
            name={expanded ? "chevron-down" : "chevron-right"}
            size="sm"
            className={styles.chevron}
          />
          <span className={styles.title}>{title}</span>
        </button>
        {headerAction !== undefined && (
          <div className={styles.headerAction}>{headerAction}</div>
        )}
      </div>
      {expanded && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}

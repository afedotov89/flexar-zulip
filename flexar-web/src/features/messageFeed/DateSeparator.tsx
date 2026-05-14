// Flexar Hub Web — feed date separator (Phase 1.6).
//
// A divider row marking the boundary between two messages that fall on
// different calendar days. The label (`Today` / `Yesterday` / a full
// date) is centred on the line; the line itself is the shared `Divider`
// primitive, drawn on each side of the label.

import { Divider } from "../../components/Divider";
import type { UnixTimestamp } from "../../domain";
import { formatDateSeparator } from "./formatting";
import styles from "./DateSeparator.module.css";

export interface DateSeparatorProps {
  /** Start-of-day timestamp of the day this separator introduces. */
  dayStart: UnixTimestamp;
}

export function DateSeparator({
  dayStart,
}: DateSeparatorProps): React.JSX.Element {
  const label = formatDateSeparator(dayStart);
  return (
    <div className={styles.separator} role="separator" aria-label={label}>
      <Divider className={styles.line} />
      <span className={styles.label}>{label}</span>
      <Divider className={styles.line} />
    </div>
  );
}

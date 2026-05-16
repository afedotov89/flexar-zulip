// Character-count indicator for the compose textarea.
//
// Hidden by default; appears once the count is "close enough" to the
// limit to be worth surfacing. Tone darkens as the user approaches and
// then exceeds the limit, matching Zulip's three-band convention:
//
//   - count < 80% of limit → not rendered (less noise)
//   - 80%..100%            → muted "approaching" tone
//   - >100%                → danger tone, and send is disabled at the
//                            call site (this component only displays).

import styles from "./LimitIndicator.module.css";

export interface LimitIndicatorProps {
  /** Current character count of the compose body. */
  count: number;
  /** Hard limit (realm max_message_length, typically 10000). */
  limit: number;
}

const APPROACHING_THRESHOLD = 0.8;

export function LimitIndicator({
  count,
  limit,
}: LimitIndicatorProps): React.JSX.Element | null {
  if (limit <= 0) {
    return null;
  }
  const ratio = count / limit;
  if (ratio < APPROACHING_THRESHOLD) {
    return null;
  }
  const tone = ratio > 1 ? "danger" : "warning";
  const cls = [styles.indicator, styles[tone]].join(" ");
  return (
    <span
      className={cls}
      role="status"
      aria-live={ratio > 1 ? "assertive" : "polite"}
    >
      {count.toLocaleString("ru-RU")} / {limit.toLocaleString("ru-RU")}
    </span>
  );
}

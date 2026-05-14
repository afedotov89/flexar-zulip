// Presence indicator dot for the DM list (Phase 1.5).
//
// A small status dot overlaid on a one-on-one DM's avatar. It collapses
// the user's `Presence` into the coarse active / idle / offline status
// (see `./presence`) and colors the dot accordingly. The freshness
// comparison is against the wall clock, read here so the pure
// `presenceStatus` helper stays clock-free and unit-testable.

import type { Presence } from "../../domain";
import { presenceStatus } from "./presence";
import styles from "./PresenceDot.module.css";

export interface PresenceDotProps {
  /** The user's collapsed presence, or `undefined` when unknown. */
  presence: Presence | undefined;
  /** Optional positioning class from the consumer. */
  className?: string;
}

// Russian labels for the accessible status text.
const statusLabel: Record<ReturnType<typeof presenceStatus>, string> = {
  active: "в сети",
  idle: "неактивен",
  offline: "не в сети",
};

const statusClass: Record<ReturnType<typeof presenceStatus>, string> = {
  active: styles.active,
  idle: styles.idle,
  offline: styles.offline,
};

export function PresenceDot({
  presence,
  className,
}: PresenceDotProps): React.JSX.Element {
  // `Presence` timestamps are Unix seconds; `Date.now()` is millis.
  const status = presenceStatus(presence, Date.now() / 1000);
  const classes = [styles.dot, statusClass[status], className]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={classes}
      role="img"
      aria-label={statusLabel[status]}
    />
  );
}

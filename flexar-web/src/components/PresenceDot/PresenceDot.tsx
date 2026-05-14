// Presence indicator dot (Phase 1.5; promoted to a shared primitive
// in Phase 1.8).
//
// A small status dot overlaid on a user's avatar — used by both the
// left sidebar's DM list and the right sidebar's user list. It
// collapses the user's `Presence` into the coarse active / idle /
// offline status (see `src/lib/presence`) and colors the dot
// accordingly. The freshness comparison is against the wall clock,
// read here so the pure `presenceStatus` helper stays clock-free and
// unit-testable.

import type { Presence } from "../../domain";
import { presenceStatus } from "../../lib/presence";
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

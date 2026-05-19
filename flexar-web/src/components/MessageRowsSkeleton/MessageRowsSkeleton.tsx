// Shared "loading rows in message-feed rhythm" placeholder.
//
// Used by the message feed and any conversation-list page (Recent /
// Inbox / Scheduled) that wants to surface "loading" without jumping
// the column when real rows arrive. A single primitive keeps the look
// consistent across routes — users moving between pages should not see
// the loader visually flip.

import { Skeleton } from "../Skeleton";
import styles from "./MessageRowsSkeleton.module.css";

export interface MessageRowsSkeletonProps {
  /** How many placeholder rows to render. Defaults to 6. */
  rows?: number;
}

const DEFAULT_ROW_COUNT = 6;

export function MessageRowsSkeleton({
  rows = DEFAULT_ROW_COUNT,
}: MessageRowsSkeletonProps): React.JSX.Element {
  return (
    <div className={styles.loading} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.loadingRow}>
          <Skeleton variant="circle" height="md" />
          <div className={styles.loadingLines}>
            <Skeleton variant="text" width="sm" height="sm" />
            <Skeleton variant="text" width="full" height="md" />
          </div>
        </div>
      ))}
    </div>
  );
}

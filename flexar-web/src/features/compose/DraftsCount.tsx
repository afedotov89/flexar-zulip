// Inline drafts shortcut for the compose bottom row.
//
// Reads the draft count straight off `useDraftsStore` so it updates
// live as the user types (the autosave debounce inside the compose
// box writes through this same store). Hidden when no drafts exist —
// no point taking horizontal space for a "(0)" counter.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useDraftsStore } from "../../stores/draftsStore";
import styles from "./DraftsCount.module.css";

export function DraftsCount(): React.JSX.Element | null {
  const drafts = useDraftsStore((s) => s.drafts);
  const count = useMemo(() => Object.keys(drafts).length, [drafts]);
  if (count === 0) {
    return null;
  }
  return (
    <Link
      to="/drafts"
      className={styles.link}
      aria-label={`Черновики (${count})`}
    >
      <Icon name="drafts" size="sm" />
      <span className={styles.label}>Черновики · {count}</span>
    </Link>
  );
}

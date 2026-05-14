// Flexar Hub Web — feed page placeholder (Phase 0.5).
//
// The index route rendered into the app-shell's center <Outlet />.
// Structural placeholder only — the real message feed is a later
// feature.

import styles from "./Feed.module.css";

export function Feed() {
  return (
    <div className={styles.feed}>
      <span className={styles.placeholderLabel}>Message feed</span>
    </div>
  );
}

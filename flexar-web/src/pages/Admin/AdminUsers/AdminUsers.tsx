// Flexar Hub Web — admin users page (Phase 5.4 placeholder).
//
// Placeholder. The real implementation lands in the 5.4 group: a single
// list with status-tab filters (Active / Deactivated / Bots), search,
// role dropdown, per-row role/deactivate/edit actions.

import styles from "./AdminUsers.module.css";

export function AdminUsers(): React.JSX.Element {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Управление пользователями</h1>
      <p className={styles.placeholder}>Раздел скоро появится.</p>
    </div>
  );
}

// Flexar Hub Web — app-shell layout (Phase 0.5).
//
// The structural skeleton of the chat UI: a full-width navbar above a
// three-column body (left navigation, center message feed, right
// contextual panel). This is STRUCTURE, not content — the columns are
// labelled placeholders. The center column hosts the routed page via
// React Router's <Outlet />.

import { Outlet } from "react-router-dom";
import { Navbar } from "../Navbar";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Navbar />

      <div className={styles.body}>
        <aside className={styles.leftSidebar} aria-label="Channels and navigation">
          <span className={styles.placeholderLabel}>Left sidebar</span>
        </aside>

        <main className={styles.center}>
          <Outlet />
        </main>

        <aside className={styles.rightSidebar} aria-label="Conversation details">
          <span className={styles.placeholderLabel}>Right sidebar</span>
        </aside>
      </div>
    </div>
  );
}

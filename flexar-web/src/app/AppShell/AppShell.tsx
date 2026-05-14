// Flexar Hub Web — app-shell layout (Phase 0.5; left sidebar 1.5).
//
// The structural skeleton of the chat UI: a full-width navbar above a
// three-column body (left navigation, center message feed, right
// contextual panel). The left column hosts the Phase 1.5 `LeftSidebar`
// feature; the right column is still a labelled placeholder. The center
// column hosts the routed page via React Router's <Outlet />.

import { Outlet } from "react-router-dom";
import { Navbar } from "../Navbar";
import { LeftSidebar } from "../../features/leftSidebar";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Navbar />

      <div className={styles.body}>
        <aside className={styles.leftSidebar} aria-label="Channels and navigation">
          <LeftSidebar />
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

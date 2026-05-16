// Flexar Hub Web — app-shell layout (Phase 0.5; left sidebar 1.5;
// right sidebar 1.8).
//
// The structural skeleton of the chat UI: a full-width navbar above a
// three-column body (left navigation, center message feed, right
// contextual panel). The left column hosts the Phase 1.5 `LeftSidebar`
// feature; the right column hosts the Phase 1.8 `RightSidebar` feature.
// The center column hosts the routed page via React Router's <Outlet />.

import { Outlet } from "react-router-dom";
import { Navbar } from "../Navbar";
import { LeftSidebar } from "../../features/leftSidebar";
import { RightSidebar } from "../../features/rightSidebar";
import { Lightbox } from "../../features/lightbox";
import { NotificationCenter } from "../../features/notifications";
import { GlobalShortcuts, KeyboardHelpOverlay } from "../../features/keyboard";
import styles from "./AppShell.module.css";

export function AppShell() {
  return (
    <div className={styles.shell}>
      <Navbar />

      <div className={styles.body}>
        <aside className={styles.leftSidebar} aria-label="Каналы и навигация">
          <LeftSidebar />
        </aside>

        <main className={styles.center}>
          <Outlet />
        </main>

        <aside className={styles.rightSidebar} aria-label="О беседе">
          <RightSidebar />
        </aside>
      </div>

      {/*
        The notification dispatcher renders no UI of its own — it
        subscribes to the realtime layer and pops desktop notifications
        for mentions / DMs while the tab is in the background. Mounted
        once for the lifetime of the authenticated shell.
      */}
      <NotificationCenter />

      {/*
        Single global image lightbox (Phase 4.2). `MessageContent`'s
        delegated click handler dispatches into `useLightboxStore`;
        this component renders the overlay when one is open.
      */}
      <Lightbox />

      {/*
        Keyboard layer (Phase 6.1). `GlobalShortcuts` registers the
        always-on chords (Cmd/Ctrl+K, `c`, `i`/`m`/`s`/`d`) and
        renders nothing; `KeyboardHelpOverlay` shows the catalogue
        Modal in response to `?`.
      */}
      <GlobalShortcuts />
      <KeyboardHelpOverlay />
    </div>
  );
}

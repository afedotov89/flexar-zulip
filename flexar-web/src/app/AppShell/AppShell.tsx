// Flexar Hub Web — app-shell layout (Phase 0.5; left sidebar 1.5;
// right sidebar 1.8; responsive drawers 6.4).
//
// The structural skeleton of the chat UI: a full-width navbar above a
// three-column body (left navigation, center message feed, right
// contextual panel). The left column hosts the Phase 1.5 `LeftSidebar`
// feature; the right column hosts the Phase 1.8 `RightSidebar` feature.
// The center column hosts the routed page via React Router's <Outlet />.
//
// ── Responsive (6.4) ────────────────────────────────────────────────
//
// Three breakpoints, in CSS:
//   ≥1024px  desktop  — both sidebars are pinned columns; the center
//                       fills what's left.
//   768–1023 tablet  — left sidebar pinned, right sidebar collapsed
//                      into a drawer behind a hamburger.
//   <768px   mobile   — both sidebars are drawers.
//
// The drawer-open/close state lives in `useDrawerStore`. Opening a
// drawer renders an overlay backdrop (`.drawerBackdrop`) the user can
// tap to dismiss; pressing Escape also closes. A route change closes
// both — the user just navigated to a new view, so the side panel has
// done its job. The wider-screen layout ignores the store entirely,
// so toggling at desktop is a harmless no-op.

import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "../Navbar";
import { LeftSidebar } from "../../features/leftSidebar";
import { RightSidebar } from "../../features/rightSidebar";
import { Lightbox } from "../../features/lightbox";
import { NetworkStatusBanner } from "../../features/networkStatus";
import { NotificationCenter } from "../../features/notifications";
import { GlobalShortcuts, KeyboardHelpOverlay } from "../../features/keyboard";
import { useI18n } from "../../lib/i18n";
import { usePresenceEmitter } from "../../lib/hooks/usePresenceEmitter";
import { useDrawerStore } from "./drawerStore";
// Side-effect import: loads the user-groups store at app-shell mount so
// its `wireStore` registers `onInitialState` and event listeners before
// the realtime connection's `start()` runs. Without this the directory
// would only hydrate the first time a UI consumer (admin groups page,
// group mention popover) is opened, missing every `user_group` event
// that landed in between.
import "../../stores/userGroupsStore";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { m } = useI18n();
  const drawerOpen = useDrawerStore((s) => s.open);
  const closeDrawer = useDrawerStore((s) => s.close);
  const location = useLocation();

  // Keep the signed-in user's presence "active" so other clients
  // see them as in-the-tab instead of decaying to "idle" /
  // "offline". The hook handles the full lifecycle (interval +
  // visibility change).
  usePresenceEmitter();

  // Close any open drawer on a route change. Drawers are a way to
  // pick a destination; once a destination is picked, the drawer's
  // job is done and the user wants the feed to be the focus.
  useEffect(() => {
    closeDrawer();
  }, [location.pathname, closeDrawer]);

  // Escape closes an open drawer. We attach the listener only while
  // a drawer is open so it doesn't shadow any feature-level Escape
  // handling the rest of the time.
  useEffect(() => {
    if (drawerOpen === null) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeDrawer();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [drawerOpen, closeDrawer]);

  // Body-scroll lock while a drawer is open — otherwise the page
  // underneath scrolls when the user pans the drawer on touch.
  useEffect(() => {
    if (drawerOpen === null) {
      return undefined;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <div className={styles.shell}>
      {/*
        Skip-link for keyboard / screen-reader users. Visually
        hidden until focused, jumps focus past the navbar straight
        to the message feed. Conventional first-tab-stop pattern
        — see WAI-ARIA APG.
      */}
      <a href="#main-content" className={styles.skipLink}>
        {m.shell.skipToContent}
      </a>
      <Navbar />

      {/*
        Network-status banner (Phase 6.8). Renders nothing while
        everything is healthy; surfaces a strip when the browser is
        offline, the realtime layer is reconnecting, or we just came
        back from an outage. Sits between the navbar and the body so
        it pushes the columns down rather than overlaying them.
      */}
      <NetworkStatusBanner />

      <div className={styles.body}>
        <aside
          className={`${styles.leftSidebar}${
            drawerOpen === "left" ? ` ${styles.drawerOpen}` : ""
          }`}
          aria-label={m.shell.leftSidebarAria}
          aria-hidden={drawerOpen !== null && drawerOpen !== "left"}
        >
          <LeftSidebar />
        </aside>

        <main
          id="main-content"
          className={styles.center}
          tabIndex={-1}
        >
          <Outlet />
        </main>

        <aside
          className={`${styles.rightSidebar}${
            drawerOpen === "right" ? ` ${styles.drawerOpen}` : ""
          }`}
          aria-label={m.shell.rightSidebarAria}
          aria-hidden={drawerOpen !== null && drawerOpen !== "right"}
        >
          <RightSidebar />
        </aside>

        {/*
          The drawer backdrop is a click-target that dismisses the
          open drawer. It is positioned by CSS (`fixed`, scrim colour)
          and only displayed when a drawer is open — hidden at every
          breakpoint when the store is closed.
        */}
        {drawerOpen !== null && (
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label={m.shell.closeDrawer}
            onClick={closeDrawer}
          />
        )}
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

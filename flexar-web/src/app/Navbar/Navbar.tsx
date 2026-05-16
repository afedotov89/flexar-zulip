// Flexar Hub Web — app-shell navbar (Phase 0.5; logout 1.1; account
// dropdown 5.x).
//
// Full-width top bar with three slots: the app-name (left), a search
// placeholder (center), and an actions cluster (right). The actions
// cluster holds the theme toggle, the user-status chip, and an
// account-menu trigger that drops down a `DropdownMenu` with
// Settings / Administration (admin-only) / Log out. The dropdown
// pattern matches modern messengers (Slack/Linear/Notion) — the navbar
// stays compact and the admin entry stays out of sight for non-admins.
//
// "Administration" routes to `/admin/users` by default — the most
// frequently-visited admin section; the user can reach the others from
// inside via the same dropdown re-opening.

import { useNavigate } from "react-router-dom";
import { DropdownMenu } from "../../components/DropdownMenu";
import type { DropdownMenuEntry } from "../../components/DropdownMenu";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { SearchBar } from "../../features/search";
import { StatusButton } from "../../features/userStatus";
import { useIsAdmin } from "../../lib/hooks/useIsAdmin";
import { useAuthStore } from "../../stores/authStore";
import { useTheme } from "../../theme";
import { useDrawerStore } from "../AppShell/drawerStore";
import styles from "./Navbar.module.css";

export function Navbar(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const nextThemeLabel = theme === "light" ? "тёмную" : "светлую";

  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();

  // Drawer toggles — only visible at the corresponding breakpoints
  // via CSS (`.drawerToggleLeft` mobile-only, `.drawerToggleRight`
  // tablet-and-below).
  const drawerOpen = useDrawerStore((s) => s.open);
  const openLeftDrawer = useDrawerStore((s) => s.openLeft);
  const openRightDrawer = useDrawerStore((s) => s.openRight);
  const closeDrawer = useDrawerStore((s) => s.close);
  const toggleLeft = (): void => {
    if (drawerOpen === "left") {
      closeDrawer();
    } else {
      openLeftDrawer();
    }
  };
  const toggleRight = (): void => {
    if (drawerOpen === "right") {
      closeDrawer();
    } else {
      openRightDrawer();
    }
  };

  function handleLogout(): void {
    logout();
    // Send the user to the login screen immediately. The route guard
    // would also catch this on the next render, but navigating here
    // keeps the transition crisp.
    void navigate("/login", { replace: true });
  }

  // Build the account-menu entries. "Administration" entry + its
  // separator are skipped entirely for non-admins (cleaner than
  // disabling, and admin-ness is not something the UI announces to
  // members).
  const accountMenuItems: DropdownMenuEntry[] = [
    {
      id: "settings",
      label: "Настройки",
      icon: "settings",
      onSelect: () => void navigate("/settings"),
    },
    ...(isAdmin
      ? ([
          { id: "admin-sep", separator: true },
          {
            id: "admin",
            label: "Администрирование",
            icon: "shield",
            onSelect: () => void navigate("/admin/users"),
          },
        ] as DropdownMenuEntry[])
      : []),
    { id: "logout-sep", separator: true },
    {
      id: "logout",
      label: "Выйти",
      icon: "log-out",
      danger: true,
      onSelect: handleLogout,
    },
  ];

  return (
    <header className={styles.navbar}>
      {/*
        Mobile-only: opens the left sidebar as a drawer. Hidden at
        ≥768px where the sidebar is a pinned column. Sits at the very
        start of the navbar so the chat icon order matches the
        sidebar's screen position.
      */}
      <span className={styles.drawerToggleLeft}>
        <IconButton
          icon="menu"
          variant="ghost"
          aria-label={
            drawerOpen === "left" ? "Закрыть боковую панель" : "Открыть боковую панель"
          }
          aria-expanded={drawerOpen === "left"}
          onClick={toggleLeft}
        />
      </span>

      <div className={styles.brand}>Flexar Hub</div>

      <div className={styles.search}>
        <SearchBar />
      </div>

      <div className={styles.actions}>
        {/*
          Tablet-and-below: opens the right sidebar (members) as a
          drawer. Hidden at ≥1024px where the right column is pinned.
        */}
        <span className={styles.drawerToggleRight}>
          <IconButton
            icon="users"
            variant="ghost"
            aria-label={
              drawerOpen === "right" ? "Закрыть участников" : "Показать участников"
            }
            aria-expanded={drawerOpen === "right"}
            onClick={toggleRight}
          />
        </span>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={`Переключить на ${nextThemeLabel} тему`}
        >
          {theme === "light" ? "Тёмная" : "Светлая"} тема
        </button>
        {session != null && (
          <div className={styles.account}>
            <StatusButton />
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className={styles.accountTrigger}
                  aria-label="Меню аккаунта"
                  title={session.email}
                >
                  <Icon name="user" size="sm" />
                  <span className={styles.accountEmail}>{session.email}</span>
                  <Icon name="chevron-down" size="sm" />
                </button>
              }
              items={accountMenuItems}
              placement="bottom"
              aria-label="Меню аккаунта"
            />
          </div>
        )}
      </div>
    </header>
  );
}

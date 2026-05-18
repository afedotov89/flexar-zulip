// Flexar Hub Web — app-shell navbar (Phase 0.5; logout 1.1; account
// dropdown 5.x; status-in-menu + identity-card trigger redesign).
//
// Full-width top bar with three slots: the app-name (left), a search
// placeholder (center), and an actions cluster (right). The actions
// cluster holds the theme toggle and an account-menu trigger that is
// also the user's identity card — avatar + full name on one line,
// status emoji + status text on the second line, with a chevron that
// drops down a `DropdownMenu` of Set/Edit status, Settings, Language,
// Administration (admin-only), Log out.
//
// "Установить статус" used to be a standalone chip in the navbar; it
// now lives at the top of the account dropdown so the navbar stays
// scannable and the identity card communicates "who am I + what am I
// doing" at a glance. The status editor opens in a popover anchored
// to the account trigger, controlled by local state.
//
// "Administration" routes to `/admin/users` by default — the most
// frequently-visited admin section; the user can reach the others from
// inside via the same dropdown re-opening.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { DropdownMenu } from "../../components/DropdownMenu";
import type { DropdownMenuEntry } from "../../components/DropdownMenu";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { Popover } from "../../components/Popover";
import { SearchBar } from "../../features/search";
import { StatusEditor } from "../../features/userStatus/StatusEditor";
import { glyphFromUnicodeEmojiCode } from "../../lib/emoji/identity";
import { useI18n, useLocaleStore } from "../../lib/i18n";
import { useAdminCapabilities } from "../../lib/hooks/useAdminCapabilities";
import { useAuthStore } from "../../stores/authStore";
import { useUsersStore } from "../../stores/usersStore";
import { useUserStatusesStore } from "../../stores/userStatusesStore";
import { useTheme } from "../../theme";
import { useDrawerStore } from "../AppShell/drawerStore";
import type { UserStatus } from "../../domain";
import styles from "./Navbar.module.css";

export function Navbar(): React.JSX.Element {
  const { mode, setMode } = useTheme();
  const { m } = useI18n();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  // Show the "Administration" entry whenever the user holds ANY
  // admin-adjacent capability — not only full realm admins. A
  // member who can create bots or manage their own group still
  // needs an entry point to /admin/*.
  const adminCaps = useAdminCapabilities();

  const ownUserId = session?.userId;
  const ownUser = useUsersStore((s) =>
    ownUserId === undefined ? undefined : s.getUser(ownUserId),
  );
  const status = useUserStatusesStore((s) =>
    ownUserId === undefined ? undefined : s.statuses[ownUserId],
  );

  // Status editor lives in a popover anchored to the account
  // trigger; controlled here so the dropdown menu item "Установить
  // статус" can open it on selection.
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);

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
    void navigate("/login", { replace: true });
  }

  // Build the account-menu entries. The first item flips between
  // "Установить статус" (no status set) and "Изменить статус"
  // (status set) — symmetry with the trigger's identity card.
  const statusLabel =
    status !== undefined &&
    (status.status_text !== "" || (status.emoji_name ?? "") !== "")
      ? m.navbar.statusEdit
      : m.navbar.statusSet;
  // Theme picker: one cycling row instead of three radio rows.
  // Theme switching is rare; eating a third of the dropdown for
  // three permanent options was a poor real-estate trade. Cycle
  // order light → dark → system → light matches the language
  // switcher's single-item cycle pattern. The leading icon and
  // label reflect the CURRENT mode so the user can verify what
  // they're on at a glance.
  const nextMode = (current: typeof mode): typeof mode =>
    current === "light"
      ? "dark"
      : current === "dark"
        ? "system"
        : "light";
  const themeLabel =
    mode === "light"
      ? m.navbar.themeLight
      : mode === "dark"
        ? m.navbar.themeDark
        : m.navbar.themeSystem;
  const themeIcon =
    mode === "light" ? "sun" : mode === "dark" ? "moon" : "monitor";

  const accountMenuItems: DropdownMenuEntry[] = [
    {
      id: "status",
      label: statusLabel,
      icon: "smile",
      onSelect: () => setStatusEditorOpen(true),
    },
    { id: "status-sep", separator: true },
    {
      id: "settings",
      label: m.navbar.settings,
      icon: "settings",
      onSelect: () => void navigate("/settings"),
    },
    // Language switcher: cycles ru ↔ en.
    {
      id: "language",
      label:
        locale === "ru" ? m.language.english : m.language.russian,
      icon: "globe",
      onSelect: () => setLocale(locale === "ru" ? "en" : "ru"),
    },
    // Theme switcher: cycles light → dark → system. Label is the
    // CURRENT theme; click to advance.
    {
      id: "theme",
      label: `${m.navbar.themeMenuPrefix}: ${themeLabel}`,
      icon: themeIcon,
      onSelect: () => setMode(nextMode(mode)),
    },
    ...(adminCaps.hasAnyAdminAccess
      ? ([
          { id: "admin-sep", separator: true },
          {
            id: "admin",
            label: m.navbar.administration,
            icon: "shield",
            // Pick a landing tab the user is actually allowed to
            // see — otherwise they'd hit the route's redirect.
            onSelect: () =>
              void navigate(landingAdminPath(adminCaps)),
          },
        ] as DropdownMenuEntry[])
      : []),
    { id: "logout-sep", separator: true },
    {
      id: "logout",
      label: m.navbar.logout,
      icon: "log-out",
      danger: true,
      onSelect: handleLogout,
    },
  ];

  return (
    <header className={styles.navbar}>
      <span className={styles.drawerToggleLeft}>
        <IconButton
          icon="menu"
          variant="ghost"
          aria-label={
            drawerOpen === "left"
              ? m.navbar.drawerCloseLeft
              : m.navbar.drawerOpenLeft
          }
          aria-expanded={drawerOpen === "left"}
          onClick={toggleLeft}
        />
      </span>

      <div className={styles.brand}>
        <img src="/favicon.svg" className={styles.brandLogo} alt="" aria-hidden />
        <span className={styles.brandText}>{m.navbar.brand}</span>
      </div>

      <div className={styles.search}>
        <SearchBar />
      </div>

      <div className={styles.actions}>
        <span className={styles.drawerToggleRight}>
          <IconButton
            icon="users"
            variant="ghost"
            aria-label={
              drawerOpen === "right"
                ? m.navbar.drawerCloseRight
                : m.navbar.drawerOpenRight
            }
            aria-expanded={drawerOpen === "right"}
            onClick={toggleRight}
          />
        </span>
        {session != null && (
          <div className={styles.account}>
            <DropdownMenu
              trigger={
                <button
                  type="button"
                  className={styles.accountTrigger}
                  aria-label={m.navbar.accountMenu}
                  title={session.email}
                >
                  <Avatar
                    size="sm"
                    name={ownUser?.full_name ?? session.email}
                    src={ownUser?.avatar_url ?? undefined}
                  />
                  <span className={styles.accountIdentity}>
                    <span className={styles.accountName}>
                      {ownUser?.full_name ?? session.email}
                    </span>
                    <span className={styles.accountStatus}>
                      {renderStatusLine(status, m.navbar.statusEmpty)}
                    </span>
                  </span>
                  <Icon name="chevron-down" size="sm" />
                </button>
              }
              items={accountMenuItems}
              placement="bottom"
              aria-label={m.navbar.accountMenu}
            />
            {/* Status editor popover, anchored to a hidden span next
                to the trigger. The Popover's `trigger` is required;
                we render a focus-invisible spacer and drive `open`
                from local state so the dropdown menu item can
                summon the editor without the user having to click
                a separate icon. */}
            <Popover
              open={statusEditorOpen}
              onOpenChange={setStatusEditorOpen}
              placement="bottom"
              aria-label={statusLabel}
              trigger={
                <span
                  className={styles.statusEditorAnchor}
                  aria-hidden="true"
                />
              }
            >
              <StatusEditor
                current={status}
                onClose={() => setStatusEditorOpen(false)}
              />
            </Popover>
          </div>
        )}
      </div>
    </header>
  );
}

// Pick the admin sub-route to land on when the user opens the
// "Administration" entry. Realm admins still land on /admin/users
// (the historical default); everyone else lands on the first tab
// their capabilities permit, so they don't bounce off the gate.
function landingAdminPath(
  caps: import("../../lib/hooks/useAdminCapabilities").AdminCapabilities,
): string {
  if (caps.isRealmAdmin) {
    return "/admin/users";
  }
  if (caps.canCreateBots || caps.canCreateWriteOnlyBots) {
    return "/admin/users";
  }
  if (
    caps.canCreateGroups ||
    caps.canManageAllGroups ||
    caps.manageableGroupIds.size > 0
  ) {
    return "/admin/groups";
  }
  if (caps.canInviteUsers) {
    return "/admin/invites";
  }
  return "/admin/users";
}

function renderStatusLine(
  status: UserStatus | undefined,
  empty: string,
): React.ReactNode {
  if (status === undefined) {
    return <span className={styles.accountStatusEmpty}>{empty}</span>;
  }
  const glyph =
    status.reaction_type === "unicode_emoji" &&
    status.emoji_code !== undefined &&
    status.emoji_code !== ""
      ? glyphFromUnicodeEmojiCode(status.emoji_code)
      : null;
  const text = status.status_text ?? "";
  if (glyph === null && text === "") {
    return <span className={styles.accountStatusEmpty}>{empty}</span>;
  }
  return (
    <>
      {glyph !== null && (
        <span className={styles.accountStatusEmoji} aria-hidden="true">
          {glyph}
        </span>
      )}
      {text !== "" && (
        <span className={styles.accountStatusText}>{text}</span>
      )}
    </>
  );
}

// Admin section sub-navigation (Phase 6.x audit follow-up).
//
// Before this, users could only reach `/admin/organization`,
// `/admin/users`, `/admin/invites` via the navbar's account dropdown
// or by typing the URL — there was no in-section way to switch
// between admin pages. A typical admin workflow (edit users, then
// adjust org settings, then send invites) needed three trips through
// the navbar menu.
//
// `AdminNav` is a slim horizontal tab strip rendered above the
// `<Outlet />` for every `/admin/*` route. Active route is matched on
// `useLocation()`. Implementation is plain `<NavLink>`s — preserves
// the browser back-button / right-click-new-tab semantics that a
// JS-driven tab list would break.

import { NavLink } from "react-router-dom";
import { Icon } from "../../components/Icon";
import type { IconName } from "../../icons";
import styles from "./AdminNav.module.css";

interface AdminTab {
  to: string;
  icon: IconName;
  label: string;
}

const TABS: readonly AdminTab[] = [
  { to: "/admin/organization", icon: "settings", label: "Организация" },
  { to: "/admin/users", icon: "users", label: "Пользователи" },
  { to: "/admin/invites", icon: "send", label: "Приглашения" },
];

export function AdminNav(): React.JSX.Element {
  return (
    <nav className={styles.nav} aria-label="Разделы администрирования">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`
          }
          end
        >
          <Icon name={tab.icon} size="sm" />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

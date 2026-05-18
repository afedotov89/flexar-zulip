// Admin section sub-navigation (Phase 6.x audit follow-up; filtered
// by capability in the bot/group/invite sweep).
//
// Before this strip existed, users could only reach the admin pages
// via the navbar's account dropdown or by typing the URL — there was
// no in-section way to switch between them. `AdminNav` is a slim
// horizontal tab strip rendered above the `<Outlet />` for every
// `/admin/*` route. Active route is matched on `useLocation()`.
// Implementation is plain `<NavLink>`s — preserves the browser
// back-button / right-click-new-tab semantics that a JS-driven tab
// list would break.
//
// Each tab is gated by the matching capability from
// `useAdminCapabilities` so a non-admin only sees the surfaces they
// can actually use:
//
//   - Организация (org settings) — realm admins only; non-admin
//     edits are bounded by per-setting group permissions today, but
//     the org page itself is a single admin-tier form.
//   - Пользователи — admins always; non-admins with bot-creation
//     rights also land here for their own bots tab.
//   - Группы — admins; users in `realm_can_create_groups`; users in
//     `realm_can_manage_all_groups`; or users who can manage any
//     individual group.
//   - Приглашения — admins or users in `realm_can_invite_users_group`.
//
// If every tab is filtered out the strip renders nothing; the route
// gate `RequireAdminAccess` already redirects users with zero
// capability away from /admin/*, so the empty case is theoretical.

import { NavLink } from "react-router-dom";
import { Icon } from "../../components/Icon";
import type { IconName } from "../../icons";
import {
  useAdminCapabilities,
  type AdminCapabilities,
} from "../../lib/hooks/useAdminCapabilities";
import styles from "./AdminNav.module.css";

interface AdminTab {
  to: string;
  icon: IconName;
  label: string;
  /** Capability predicate; the tab is hidden when this returns false. */
  visible: (caps: AdminCapabilities) => boolean;
}

const TABS: readonly AdminTab[] = [
  {
    to: "/admin/organization",
    icon: "settings",
    label: "Организация",
    visible: (caps) => caps.canManageOrg,
  },
  {
    to: "/admin/users",
    icon: "users",
    label: "Пользователи",
    visible: (caps) =>
      caps.isRealmAdmin || caps.canCreateBots || caps.canCreateWriteOnlyBots,
  },
  // Reuses the `users` icon — the icon set has no separate "group"
  // glyph and the label text disambiguates in the nav.
  {
    to: "/admin/groups",
    icon: "users",
    label: "Группы",
    visible: (caps) =>
      caps.isRealmAdmin ||
      caps.canCreateGroups ||
      caps.canManageAllGroups ||
      caps.manageableGroupIds.size > 0,
  },
  {
    to: "/admin/invites",
    icon: "send",
    label: "Приглашения",
    visible: (caps) => caps.isRealmAdmin || caps.canInviteUsers,
  },
];

export function AdminNav(): React.JSX.Element {
  const caps = useAdminCapabilities();
  const visibleTabs = TABS.filter((tab) => tab.visible(caps));
  return (
    <nav className={styles.nav} aria-label="Разделы администрирования">
      {visibleTabs.map((tab) => (
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

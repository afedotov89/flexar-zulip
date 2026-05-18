// Flexar Hub Web — admin users management page (Phase 5.4; bots tab
// opened to non-admin owners in the capability sweep).
//
// Three-tab status filter (Active / Deactivated / Bots) over the
// `useUsersStore` directory, plus a search box and a role dropdown.
// Active rows expose Edit and Deactivate actions; deactivated rows
// expose Reactivate.
//
// Capability gating:
//   - Realm admins see all three tabs and every user/bot in the
//     realm (the historical behaviour).
//   - Non-admins reach this page only when they hold
//     `can_create_bots_group` or `can_create_write_only_bots_group`
//     (the route gate enforces this). For them, the people tabs
//     ("Active" / "Deactivated") are hidden — they aren't allowed
//     to manage humans — and the Bots tab lists only their own
//     bots (`bot_owner_id === self`). The active tab is forced to
//     "bots" when the people tabs are hidden so the page never
//     renders an inaccessible tab as active.
//
// Self-actions are hidden: the signed-in user cannot deactivate or
// edit themselves from this screen — that requires either the personal
// settings page or another admin.
//
// Mutations go through dedicated modal components which write
// optimistically into `useUsersStore` (snapshot/restore on REST
// failure) and call the corresponding `apiClient` method. The
// realtime `realm_user` event eventually reconciles either way.

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "../../../components/Avatar";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Select } from "../../../components/Select";
import type { SelectOption } from "../../../components/Select";
import { Spinner } from "../../../components/Spinner";
import { Tabs } from "../../../components/Tabs";
import type { TabItem } from "../../../components/Tabs";
import type { Role, User } from "../../../domain";
import { RoleValues } from "../../../domain";
import { useAdminCapabilities } from "../../../lib/hooks/useAdminCapabilities";
import { useAuthStore } from "../../../stores/authStore";
import { useRealmStore } from "../../../stores/realmStore";
import { useUsersStore } from "../../../stores/usersStore";
import { CreateBotModal } from "./CreateBotModal";
import { DeactivateUserModal } from "./DeactivateUserModal";
import { EditBotModal } from "./EditBotModal";
import { EditUserModal } from "./EditUserModal";
import { ReactivateConfirmModal } from "./ReactivateConfirmModal";
import { RegenerateBotKeyModal } from "./RegenerateBotKeyModal";
import styles from "./AdminUsers.module.css";

type StatusTab = "active" | "deactivated" | "bots";

const PEOPLE_TABS: TabItem[] = [
  { id: "active", label: "Активные" },
  { id: "deactivated", label: "Деактивированные" },
  { id: "bots", label: "Боты" },
];

const BOTS_ONLY_TABS: TabItem[] = [{ id: "bots", label: "Боты" }];

const ALL_ROLES = "all";

const roleFilterOptions: SelectOption[] = [
  { value: ALL_ROLES, label: "Все роли" },
  { value: String(RoleValues.Owner), label: "Владелец" },
  { value: String(RoleValues.Administrator), label: "Администратор" },
  { value: String(RoleValues.Moderator), label: "Модератор" },
  { value: String(RoleValues.Member), label: "Участник" },
  { value: String(RoleValues.Guest), label: "Гость" },
];

const roleLabels: Record<Role, string> = {
  [RoleValues.Owner]: "Владелец",
  [RoleValues.Administrator]: "Администратор",
  [RoleValues.Moderator]: "Модератор",
  [RoleValues.Member]: "Участник",
  [RoleValues.Guest]: "Гость",
};

// Owner / admin / moderator stand out (accent); member / guest are
// neutral pills. Mirrors the visual weight of the underlying role.
function badgeVariantForRole(role: Role): "neutral" | "accent" {
  if (
    role === RoleValues.Owner ||
    role === RoleValues.Administrator ||
    role === RoleValues.Moderator
  ) {
    return "accent";
  }
  return "neutral";
}

function matchesSearch(user: User, query: string): boolean {
  if (query === "") {
    return true;
  }
  const haystack = `${user.full_name} ${user.email}`.toLowerCase();
  return haystack.includes(query);
}

export function AdminUsers(): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);
  const sessionUserId = useAuthStore((s) => s.session?.userId);
  const caps = useAdminCapabilities();
  // Non-admins reach this page only to manage their own bots, so the
  // people-management tabs are hidden and the active tab is forced
  // to "bots". For admins both views remain.
  const showPeopleTabs = caps.isRealmAdmin;
  const visibleTabs = showPeopleTabs ? PEOPLE_TABS : BOTS_ONLY_TABS;
  // Gate the list spinner on the directory itself, not on realtime
  // status — directory hydrates from `persist` cache instantly on
  // every reload, while realtime can take seconds to reach
  // "connected" on a flaky WAN. Showing a spinner while we already
  // have the data to render is a misleading lie. See the same
  // rationale in `RequireAdmin`.
  const directoryLoading = Object.keys(usersMap).length === 0;

  const [activeTab, setActiveTab] = useState<StatusTab>(
    showPeopleTabs ? "active" : "bots",
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [reactivating, setReactivating] = useState<User | null>(null);
  const [creatingBot, setCreatingBot] = useState(false);
  const [editingBot, setEditingBot] = useState<User | null>(null);
  const [regenBot, setRegenBot] = useState<User | null>(null);

  // Realm URL — used to format bot emails / build zuliprc downloads
  // for the create + regenerate-key flows.
  const realmUrl = useRealmStore((s) => s.realm?.realm_url);

  // Owner-or-admin gate for per-bot actions. Admins can edit any
  // bot; non-admins only theirs.
  const canManageBot = (bot: User): boolean =>
    caps.isRealmAdmin || bot.bot_owner_id === sessionUserId;

  // Create-bot button is enabled if the user has any bot-creation
  // capability. Disabled (with explanation) for admins on a realm
  // that disallows creation, though the route gate alone would
  // already prevent reaching this view in the no-capability case.
  const canCreateAnyBot =
    caps.isRealmAdmin || caps.canCreateBots || caps.canCreateWriteOnlyBots;

  // If caps hydrate after mount and the people tabs become hidden,
  // reset any selection on a tab the user can't see. The reverse
  // (admin status arriving late) is rare; we don't force them off
  // the bots tab to avoid disrupting a deliberate choice.
  useEffect(() => {
    if (!showPeopleTabs && activeTab !== "bots") {
      setActiveTab("bots");
    }
  }, [showPeopleTabs, activeTab]);

  const visible = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const all = Object.values(usersMap);
    const byTab = all.filter((user) => {
      if (activeTab === "bots") {
        if (!user.is_bot) {
          return false;
        }
        // Non-admins only see bots they own. Admins (the bots-list
        // analogue of the people lists) see every bot in the realm.
        if (!caps.isRealmAdmin) {
          return user.bot_owner_id === sessionUserId;
        }
        return true;
      }
      if (user.is_bot) {
        return false;
      }
      return activeTab === "active" ? user.is_active : !user.is_active;
    });
    const bySearch = byTab.filter((user) => matchesSearch(user, trimmed));
    const byRole =
      activeTab === "bots" || roleFilter === ALL_ROLES
        ? bySearch
        : bySearch.filter((user) => String(user.role) === roleFilter);
    return [...byRole].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, undefined, {
        sensitivity: "base",
      }),
    );
  }, [activeTab, roleFilter, search, usersMap, caps.isRealmAdmin, sessionUserId]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Управление пользователями</h1>

      <Tabs
        tabs={visibleTabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as StatusTab)}
        aria-label="Фильтр по статусу"
      >
        {() => (
          <>
            <div className={styles.filters}>
              <Input
                aria-label="Поиск пользователя"
                type="search"
                iconLeft="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Поиск"
                className={styles.search}
              />
              {activeTab !== "bots" && (
                <Select
                  aria-label="Фильтр по роли"
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(event.currentTarget.value)
                  }
                  options={roleFilterOptions}
                  className={styles.roleSelect}
                />
              )}
              {activeTab === "bots" && canCreateAnyBot && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  iconLeft="plus"
                  onClick={() => setCreatingBot(true)}
                >
                  Создать бота
                </Button>
              )}
            </div>

            {directoryLoading ? (
              <div className={styles.loading}>
                <Spinner aria-label="Загрузка пользователей" />
              </div>
            ) : visible.length === 0 ? (
              <p className={styles.empty}>Никого не найдено.</p>
            ) : (
              <ul className={styles.list} aria-label="Пользователи">
                {visible.map((user) => {
                  const isSelf =
                    sessionUserId !== undefined &&
                    user.user_id === sessionUserId;
                  return (
                    <li key={user.user_id} className={styles.row}>
                      <Avatar
                        size="sm"
                        name={user.full_name}
                        src={user.avatar_url ?? undefined}
                      />
                      <div className={styles.info}>
                        <span className={styles.name}>{user.full_name}</span>
                        <span className={styles.email}>{user.email}</span>
                      </div>
                      {!user.is_bot && (
                        <span className={styles.badgeSlot}>
                          <Badge variant={badgeVariantForRole(user.role)}>
                            {roleLabels[user.role] ?? "—"}
                          </Badge>
                        </span>
                      )}
                      <div className={styles.actions}>
                        {activeTab === "active" && !user.is_bot && !isSelf && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(user)}
                            >
                              Изменить
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeactivating(user)}
                            >
                              Деактивировать
                            </Button>
                          </>
                        )}
                        {activeTab === "bots" && canManageBot(user) && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingBot(user)}
                            >
                              Изменить
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRegenBot(user)}
                            >
                              Сбросить ключ
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeactivating(user)}
                            >
                              Деактивировать
                            </Button>
                          </>
                        )}
                        {activeTab === "deactivated" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReactivating(user)}
                          >
                            Восстановить
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Tabs>

      {editing !== null && (
        <EditUserModal
          open={true}
          user={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deactivating !== null && (
        <DeactivateUserModal
          open={true}
          user={deactivating}
          onClose={() => setDeactivating(null)}
        />
      )}
      {reactivating !== null && (
        <ReactivateConfirmModal
          open={true}
          user={reactivating}
          onClose={() => setReactivating(null)}
        />
      )}
      {creatingBot && (
        <CreateBotModal
          open={true}
          capabilities={caps}
          realmUrl={realmUrl}
          onClose={() => setCreatingBot(false)}
        />
      )}
      {editingBot !== null && (
        <EditBotModal
          open={true}
          bot={editingBot}
          onClose={() => setEditingBot(null)}
        />
      )}
      {regenBot !== null && (
        <RegenerateBotKeyModal
          open={true}
          bot={regenBot}
          realmUrl={realmUrl}
          onClose={() => setRegenBot(null)}
        />
      )}
    </div>
  );
}

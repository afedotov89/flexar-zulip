// Flexar Hub Web — admin users management page (Phase 5.4).
//
// Three-tab status filter (Active / Deactivated / Bots) over the
// `useUsersStore` directory, plus a search box and a role dropdown.
// Active rows expose Edit and Deactivate actions; deactivated rows
// expose Reactivate. The bot tab is read-only this iteration.
//
// Self-actions are hidden: the signed-in user cannot deactivate or
// edit themselves from this screen — that requires either the personal
// settings page or another admin.
//
// Mutations go through dedicated modal components which write
// optimistically into `useUsersStore` (snapshot/restore on REST
// failure) and call the corresponding `apiClient` method. The
// realtime `realm_user` event eventually reconciles either way.

import { useMemo, useState } from "react";
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
import { useStoresLoading } from "../../../lib/hooks/useRealtimeStatus";
import { useAuthStore } from "../../../stores/authStore";
import { useUsersStore } from "../../../stores/usersStore";
import { DeactivateUserModal } from "./DeactivateUserModal";
import { EditUserModal } from "./EditUserModal";
import { ReactivateConfirmModal } from "./ReactivateConfirmModal";
import styles from "./AdminUsers.module.css";

type StatusTab = "active" | "deactivated" | "bots";

const tabs: TabItem[] = [
  { id: "active", label: "Активные" },
  { id: "deactivated", label: "Деактивированные" },
  { id: "bots", label: "Боты" },
];

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
  const storesLoading = useStoresLoading();

  const [activeTab, setActiveTab] = useState<StatusTab>("active");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [editing, setEditing] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const [reactivating, setReactivating] = useState<User | null>(null);

  const visible = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    const all = Object.values(usersMap);
    const byTab = all.filter((user) => {
      if (activeTab === "bots") {
        return user.is_bot;
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
  }, [activeTab, roleFilter, search, usersMap]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Управление пользователями</h1>

      <Tabs
        tabs={tabs}
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
            </div>

            {storesLoading ? (
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
                        {activeTab === "active" && !isSelf && (
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
    </div>
  );
}

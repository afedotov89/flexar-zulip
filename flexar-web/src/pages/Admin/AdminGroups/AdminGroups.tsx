// Flexar Hub Web — admin user-groups list page (Phase B2/B3;
// capability-aware filtering in the bot/group/invite sweep).
//
// Lists every user group from `useUserGroupsStore` (hydrated at app-
// shell mount + folded by `user_group` events). Each row is a link to
// `/admin/groups/:id` for the detail view. System groups carry a
// badge and stay first in the order so realm roles are easy to find.
//
// B2 adds search + 3-tab filter (Все / Мои / Кастомные) + a skeleton
// state while the realtime layer hydrates, and distinguishes "no
// groups at all" from "no search matches".
//
// B3 adds the "Создать группу" header button which opens
// `CreateGroupModal`. The modal handles its own state; success is
// reflected here purely through the realtime `user_group:add` event
// folding into the store (no optimistic push).
//
// Capability gating:
//   - "Создать группу" is hidden unless the user is a realm admin
//     or in `realm_can_create_groups`.
//   - The custom-groups list filters to groups the user can manage
//     (any of can_manage_group / can_add_members_group /
//     can_remove_members_group) OR is a direct member of — unless
//     they're a realm admin or `can_manage_all_groups`, in which
//     case every custom group shows. System groups stay visible to
//     everyone in the tree section above the list because they're
//     the realm-role roster (not editable from here either way).

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../../components/Badge";
import { Button } from "../../../components/Button";
import { EmptyState } from "../../../components/EmptyState";
import { Icon } from "../../../components/Icon";
import { Input } from "../../../components/Input";
import { Skeleton } from "../../../components/Skeleton";
import { Tabs } from "../../../components/Tabs";
import type { TabItem } from "../../../components/Tabs";
import type { UserGroup } from "../../../domain";
import { useAdminCapabilities } from "../../../lib/hooks/useAdminCapabilities";
import { useStoresLoading } from "../../../lib/hooks/useRealtimeStatus";
import {
  buildGroupTree,
  computeTransitiveMembers,
  type TreeNode,
} from "../../../lib/userGroups";
import { useAuthStore } from "../../../stores/authStore";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { CreateGroupModal } from "./CreateGroupModal";
import { SystemGroupTree } from "./SystemGroupTree";
import styles from "./AdminGroups.module.css";

type FilterTab = "all" | "mine" | "custom";

const tabs: TabItem[] = [
  { id: "all", label: "Все" },
  { id: "mine", label: "Мои" },
  { id: "custom", label: "Кастомные" },
];

// "Мои" deliberately uses direct membership only — transitive lookup
// (walking the subgroup graph) lands in a later phase. Direct
// membership is the visible attachment most admins reach for.
function isDirectMember(group: UserGroup, viewerId: number): boolean {
  return group.members.includes(viewerId);
}

function matchesQuery(group: UserGroup, query: string): boolean {
  if (query === "") {
    return true;
  }
  const haystack = `${group.name} ${group.description}`.toLowerCase();
  return haystack.includes(query);
}

function sortGroups(
  groups: UserGroup[],
  systemFirst: boolean,
): UserGroup[] {
  return [...groups].sort((a, b) => {
    if (systemFirst && a.is_system_group !== b.is_system_group) {
      return a.is_system_group ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

const SKELETON_ROWS = 4;

export function AdminGroups(): React.JSX.Element {
  const directory = useUserGroupsStore((s) => s.userGroups);
  const viewerUserId = useAuthStore((s) => s.session?.userId);
  const hydrating = useStoresLoading();
  const caps = useAdminCapabilities();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const directoryEmpty = Object.keys(directory).length === 0;

  const visible = useMemo<UserGroup[]>(() => {
    // Realm admins and `can_manage_all_groups` members see every
    // custom group; everyone else only sees groups they can mutate
    // (manage / add / remove members) or are a direct member of.
    const seesEveryGroup = caps.isRealmAdmin || caps.canManageAllGroups;
    const isVisibleToViewer = (group: UserGroup): boolean => {
      if (seesEveryGroup) {
        return true;
      }
      if (caps.manageableGroupIds.has(group.id)) {
        return true;
      }
      if (
        viewerUserId !== undefined &&
        isDirectMember(group, viewerUserId)
      ) {
        return true;
      }
      return false;
    };

    const trimmed = search.trim().toLowerCase();
    const all = Object.values(directory);
    const byTab = all.filter((group) => {
      if (activeTab === "all") {
        // System groups live in the separate tree section above the
        // flat list (Variant C); excluding them here prevents them
        // from showing twice on the "Все" tab.
        if (group.is_system_group) {
          return false;
        }
        return isVisibleToViewer(group);
      }
      if (activeTab === "custom") {
        if (group.is_system_group) {
          return false;
        }
        return isVisibleToViewer(group);
      }
      if (activeTab === "mine") {
        return (
          viewerUserId !== undefined && isDirectMember(group, viewerUserId)
        );
      }
      return true;
    });
    const bySearch = byTab.filter((group) => matchesQuery(group, trimmed));
    return sortGroups(bySearch, false);
  }, [
    activeTab,
    caps.isRealmAdmin,
    caps.canManageAllGroups,
    caps.manageableGroupIds,
    directory,
    search,
    viewerUserId,
  ]);

  // Filter system groups for the tree section, applying the same
  // search query so the tree collapses to matches just like the list.
  const systemGroups = useMemo<UserGroup[]>(() => {
    if (activeTab !== "all") {
      return [];
    }
    const trimmed = search.trim().toLowerCase();
    return Object.values(directory)
      .filter((g) => g.is_system_group)
      .filter((g) => matchesQuery(g, trimmed))
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
  }, [activeTab, directory, search]);

  // Three honest states for the list body:
  //   1. hydrating (realtime hasn't delivered the register snapshot
  //      yet) → skeleton rows, so the page doesn't pop on hydrate;
  //   2. directory empty + hydrated → "Нет групп";
  //   3. directory non-empty but the current tab/search filters to
  //      zero rows → "Нет совпадений" (the distinction matters: the
  //      user did something, and reset is the actionable response).
  function renderBody(): React.JSX.Element {
    if (hydrating && directoryEmpty) {
      return (
        <ul className={styles.list} aria-label="Загрузка групп" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <li key={i} className={styles.skeletonRow}>
              <Skeleton variant="text" width="md" height="md" />
            </li>
          ))}
        </ul>
      );
    }

    if (visible.length === 0) {
      if (directoryEmpty) {
        return (
          <EmptyState
            icon="users"
            title="Нет групп"
            description="Группы появятся здесь, как только сервер их пришлёт."
          />
        );
      }
      // On "Все" with non-empty directory but zero visible rows: the
      // tree section above holds all the system groups, so the
      // emptiness is specifically about custom groups. Search is a
      // separate axis — distinguish.
      if (activeTab === "all" && search.trim() === "") {
        return (
          <EmptyState
            tone="muted"
            icon="users"
            title="Нет пользовательских групп"
            description="Создайте первую через «Создать группу» — системные роли видно в дереве выше."
          />
        );
      }
      return (
        <EmptyState
          icon="search"
          title="Нет совпадений"
          description="Поменяйте запрос или выберите другой фильтр."
        />
      );
    }

    // Custom groups can nest too — render the visible slice through
    // `buildGroupTree` so a group that's a subgroup of another shows
    // nested under it instead of duplicated at the top level. Groups
    // without children render as plain rows (the tree degrades to
    // flat when there's no hierarchy), so the simple case looks the
    // same.
    const tree = buildGroupTree(visible);
    return (
      <ul className={styles.list} aria-label="Список групп">
        {tree.map((node) => (
          <GroupRow key={node.group.id} node={node} directory={directory} />
        ))}
      </ul>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Группы</h1>
          <p className={styles.headerHint}>
            Группы пользователей: системные роли и пользовательские.
          </p>
        </div>
        <div className={styles.headerActions}>
          {caps.canCreateGroups && (
            <Button
              type="button"
              variant="primary"
              size="md"
              iconLeft="plus"
              onClick={() => setShowCreateModal(true)}
            >
              Создать группу
            </Button>
          )}
        </div>
      </header>

      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as FilterTab)}
        aria-label="Фильтр групп"
      >
        {() => (
          <>
            <div className={styles.toolbar}>
              <Input
                aria-label="Поиск группы"
                type="search"
                iconLeft="search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Поиск"
                className={styles.search}
              />
            </div>
            {activeTab === "all" && systemGroups.length > 0 && (
              <SystemGroupTree
                systemGroups={systemGroups}
                directory={directory}
              />
            )}
            {renderBody()}
          </>
        )}
      </Tabs>

      <CreateGroupModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </section>
  );
}

interface GroupRowProps {
  node: TreeNode;
  directory: Readonly<Record<number, UserGroup>>;
}

function GroupRow({ node, directory }: GroupRowProps): React.JSX.Element {
  const { group, children } = node;
  const memberCount = computeTransitiveMembers(group.id, directory).size;
  return (
    <li>
      <Link
        to={`/admin/groups/${group.id}`}
        className={styles.row}
        title="Открыть для редактирования"
      >
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{group.name}</span>
          {group.description !== "" && (
            <span className={styles.rowDescription}>{group.description}</span>
          )}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.memberCount}>{memberCount} чел.</span>
          {group.is_system_group && (
            <Badge variant="neutral">Системная</Badge>
          )}
          <Icon name="chevron-right" size="sm" className={styles.rowChevron} />
        </span>
      </Link>
      {children.length > 0 && (
        <ul className={styles.childList}>
          {children.map((child) => (
            <GroupRow
              key={child.group.id}
              node={child}
              directory={directory}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

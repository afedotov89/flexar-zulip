// Subgroups tab for the admin user-group detail page (Phase C3).
//
// Lists the group's DIRECT subgroups as a plain list (not a tree).
// Each row: name + system badge + direct-member count + link to that
// subgroup's detail page. Subgroups that no longer exist in the
// directory render as "(удалена)" greyed-out — removal is still
// permitted so admins can clean up dangling references.
//
// Editing: an inline `AddSubgroupInput` typeahead with client-side
// cycle prevention (`wouldCreateCycle`) excludes self, system groups,
// already-direct subgroups, and any group whose subgraph already
// contains this group. Server enforces the same; pre-filtering keeps
// the UX honest. Add/remove go through `apiClient.addUserGroupSubgroups`
// / `apiClient.removeUserGroupSubgroups` and fold back via realtime.
//
// Read-only modes (system or deactivated): the picker and remove
// buttons are hidden; a top banner explains why.

import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { apiClient } from "../../../api";
import { Badge } from "../../../components/Badge";
import { Banner } from "../../../components/Banner";
import { IconButton } from "../../../components/IconButton";
import type { UserGroup } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUserGroupsStore } from "../../../stores/userGroupsStore";
import { AddSubgroupInput } from "./AddSubgroupInput";
import { RemoveSubgroupConfirmModal } from "./RemoveSubgroupConfirmModal";
import styles from "./SubgroupsTab.module.css";

export interface SubgroupsTabProps {
  group: UserGroup;
  caps: import("../../../lib/hooks/useGroupCapabilities").GroupCapabilities;
}

type Directory = Record<number, UserGroup>;

/**
 * Would adding `candidateId` as a direct subgroup of `parentId` close a
 * loop? `true` when:
 *   - `candidateId === parentId` (a group can't contain itself), or
 *   - `parentId` is reachable from `candidateId` via
 *     `direct_subgroup_ids` (so the new edge would close a cycle).
 *
 * Used by the typeahead filter so admins never see suggestions the
 * server will reject. Pure helper — exported for unit testing.
 */
export function wouldCreateCycle(
  parentId: number,
  candidateId: number,
  directory: Directory,
): boolean {
  if (parentId === candidateId) {
    return true;
  }
  const visited = new Set<number>();
  const stack: number[] = [candidateId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      break;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    if (current === parentId) {
      return true;
    }
    const node = directory[current];
    if (node === undefined) {
      continue;
    }
    for (const child of node.direct_subgroup_ids) {
      if (!visited.has(child)) {
        stack.push(child);
      }
    }
  }
  return false;
}

interface RemoveTarget {
  id: number;
  name: string;
}

export function SubgroupsTab({
  group,
  caps,
}: SubgroupsTabProps): React.JSX.Element {
  const directory = useUserGroupsStore((s) => s.userGroups);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  // Subgroup mutations are governed by `can_manage_group` (Zulip
  // doesn't expose a separate setting for them). System / deactivated
  // groups are read-only by policy regardless.
  const readOnly =
    group.is_system_group || group.deactivated || !caps.canManage;

  // Sorted rows: known subgroups alphabetically by name, missing ones
  // pushed to the end (mirrors MembersTab's "unknown last" pattern).
  const rows = useMemo(() => {
    const resolved = group.direct_subgroup_ids.map((id) => ({
      id,
      sub: directory[id],
    }));
    resolved.sort((a, b) => {
      if (a.sub === undefined && b.sub === undefined) {
        return a.id - b.id;
      }
      if (a.sub === undefined) {
        return 1;
      }
      if (b.sub === undefined) {
        return -1;
      }
      return a.sub.name.localeCompare(b.sub.name, undefined, {
        sensitivity: "base",
      });
    });
    return resolved;
  }, [group.direct_subgroup_ids, directory]);

  // The full cycle-aware exclusion set the typeahead needs: self,
  // current direct subgroups, plus any group that would close a cycle
  // (the cycle check covers self too, but listing it explicitly keeps
  // the intent visible).
  const excludedIds = useMemo<number[]>(() => {
    const excluded = new Set<number>();
    excluded.add(group.id);
    for (const id of group.direct_subgroup_ids) {
      excluded.add(id);
    }
    for (const candidate of Object.values(directory)) {
      if (wouldCreateCycle(group.id, candidate.id, directory)) {
        excluded.add(candidate.id);
      }
    }
    return Array.from(excluded);
  }, [group.id, group.direct_subgroup_ids, directory]);

  const handleAdd = async (subgroupId: number): Promise<void> => {
    setError(null);
    try {
      await apiClient.addUserGroupSubgroups(group.id, [subgroupId]);
      // Success: realtime `user_group:add_subgroups` folds into the store.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось добавить подгруппу."));
    }
  };

  const handleRemove = async (subgroupId: number): Promise<void> => {
    setError(null);
    try {
      await apiClient.removeUserGroupSubgroups(group.id, [subgroupId]);
      setRemoveTarget(null);
      // Success: realtime `user_group:remove_subgroups` folds into the store.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось убрать подгруппу."));
    }
  };

  return (
    <div className={styles.tabPanel}>
      {group.is_system_group && (
        <Banner tone="info">
          Системная группа — управление подгруппами недоступно.
        </Banner>
      )}
      {!group.is_system_group && group.deactivated && (
        <Banner tone="warning">
          Группа деактивирована — реактивируйте её на вкладке «Обзор»,
          чтобы редактировать подгруппы.
        </Banner>
      )}

      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <h2 className={styles.sectionHeading}>
        Прямые подгруппы ({group.direct_subgroup_ids.length})
      </h2>

      {!readOnly && (
        <AddSubgroupInput
          excludedIds={excludedIds}
          onSelect={(id) => void handleAdd(id)}
        />
      )}

      {rows.length === 0 ? (
        <p className={styles.empty}>
          У группы нет подгрупп
          {!readOnly && " — добавьте их через поле выше."}
        </p>
      ) : (
        <ul className={styles.list} aria-label="Прямые подгруппы группы">
          {rows.map(({ id, sub }) => {
            const missing = sub === undefined;
            const displayName = sub?.name ?? "(удалена)";
            const memberCount = sub?.members.length;
            return (
              <li
                key={id}
                className={
                  missing ? `${styles.row} ${styles.rowMissing}` : styles.row
                }
              >
                <span className={styles.text}>
                  <span className={styles.name}>{displayName}</span>
                  <span className={styles.meta}>
                    <span>
                      {memberCount === undefined
                        ? "— чел."
                        : `${memberCount} чел.`}
                    </span>
                    {sub?.is_system_group && (
                      <Badge variant="neutral">Системная</Badge>
                    )}
                  </span>
                </span>
                {!missing && (
                  <Link
                    to={`/admin/groups/${id}`}
                    className={styles.openLink}
                  >
                    Перейти
                  </Link>
                )}
                {!readOnly && (
                  <IconButton
                    icon="close"
                    aria-label={`Убрать подгруппу ${displayName} из группы`}
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveTarget({ id, name: displayName })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {removeTarget !== null && (
        <RemoveSubgroupConfirmModal
          open={removeTarget !== null}
          subgroupName={removeTarget.name}
          parentName={group.name}
          onClose={() => setRemoveTarget(null)}
          onConfirm={() => handleRemove(removeTarget.id)}
        />
      )}
    </div>
  );
}

// Members tab for the admin user-group detail page (Phase C2).
//
// Lists the group's DIRECT members; transitive members (reachable via
// subgroups) are deferred — we'd need a recursive walker over
// `direct_subgroup_ids`. A muted footnote calls this out so the
// difference between "direct only" and a full transitive view is
// visible to operators.
//
// Editing: an inline `AddMemberInput` typeahead adds members via
// `apiClient.addUserGroupMembers`; per-row IconButton + confirm-modal
// removes via `apiClient.removeUserGroupMembers`. Both mutations are
// folded back into the store by the realtime `user_group:add_members`
// / `user_group:remove_members` events — no optimistic push. Errors
// surface as a single dismissable Banner.
//
// Read-only modes (system or deactivated): the picker and remove
// buttons are hidden; a top banner explains why. Members are still
// shown so admins can audit the roster.

import { useMemo, useState } from "react";
import { apiClient } from "../../../api";
import { Avatar } from "../../../components/Avatar";
import { Banner } from "../../../components/Banner";
import { IconButton } from "../../../components/IconButton";
import type { User, UserGroup, UserId } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import { AddMemberInput } from "../AdminGroups/AddMemberInput";
import styles from "./MembersTab.module.css";
import { RemoveMemberConfirmModal } from "./RemoveMemberConfirmModal";

export interface MembersTabProps {
  group: UserGroup;
  caps: import("../../../lib/hooks/useGroupCapabilities").GroupCapabilities;
}

interface Resolved {
  userId: UserId;
  user: User | undefined;
}

export function MembersTab({
  group,
  caps,
}: MembersTabProps): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserId | null>(null);

  // Membership add / remove split by capability — the user might be
  // able to add but not remove members (or vice versa). The legacy
  // single `readOnly` flag is preserved for "should we render the
  // section at all" / status banner decisions.
  const readOnly = group.is_system_group || group.deactivated;
  const canAdd = !readOnly && caps.canAddMembers;
  const canRemove = !readOnly && caps.canRemoveMembers;

  const rows = useMemo<Resolved[]>(() => {
    const resolved = group.members.map((id) => ({
      userId: id,
      user: usersMap[id],
    }));
    resolved.sort((a, b) => {
      // Unknown users last, otherwise alphabetical by full_name.
      if (a.user === undefined && b.user === undefined) {
        return a.userId - b.userId;
      }
      if (a.user === undefined) {
        return 1;
      }
      if (b.user === undefined) {
        return -1;
      }
      return a.user.full_name.localeCompare(b.user.full_name);
    });
    return resolved;
  }, [group.members, usersMap]);

  const handleAdd = async (userId: UserId): Promise<void> => {
    setError(null);
    try {
      await apiClient.addUserGroupMembers(group.id, [userId]);
      // Success: realtime `user_group:add_members` folds into the store.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось добавить участника."));
    }
  };

  const handleRemove = async (userId: UserId): Promise<void> => {
    setError(null);
    try {
      await apiClient.removeUserGroupMembers(group.id, [userId]);
      setRemoveTarget(null);
      // Success: realtime `user_group:remove_members` folds into the store.
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось удалить участника."));
    }
  };

  return (
    <div className={styles.tabPanel}>
      {group.is_system_group && (
        <Banner tone="info">
          Системная группа — управление участниками недоступно.
        </Banner>
      )}
      {!group.is_system_group && group.deactivated && (
        <Banner tone="warning">
          Группа деактивирована — реактивируйте её на вкладке «Обзор»,
          чтобы редактировать участников.
        </Banner>
      )}

      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <h2 className={styles.sectionHeading}>
        Прямые участники ({group.members.length})
      </h2>

      {canAdd && (
        <AddMemberInput
          existingIds={group.members}
          onSelect={(userId) => void handleAdd(userId)}
        />
      )}

      {rows.length === 0 ? (
        <p className={styles.empty}>
          В группе нет участников
          {canAdd && " — добавьте их через поле выше."}
        </p>
      ) : (
        <ul className={styles.list} aria-label="Прямые участники группы">
          {rows.map(({ userId, user }) => {
            const displayName = user?.full_name ?? `Пользователь #${userId}`;
            return (
              <li key={userId} className={styles.row}>
                <Avatar
                  src={user?.avatar_url ?? undefined}
                  name={displayName}
                  size="sm"
                />
                <span className={styles.text}>
                  <span className={styles.name}>{displayName}</span>
                  {user?.email !== undefined && (
                    <span className={styles.email}>{user.email}</span>
                  )}
                </span>
                {canRemove && (
                  <IconButton
                    icon="close"
                    aria-label={`Удалить ${displayName} из группы`}
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveTarget(userId)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className={styles.footnote}>
        Участники подгрупп здесь не учитываются — раскрытие появится позже.
      </p>

      {removeTarget !== null && (
        <RemoveMemberConfirmModal
          open={removeTarget !== null}
          userId={removeTarget}
          groupName={group.name}
          onClose={() => setRemoveTarget(null)}
          onConfirm={() => handleRemove(removeTarget)}
        />
      )}
    </div>
  );
}

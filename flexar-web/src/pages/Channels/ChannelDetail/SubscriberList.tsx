// Subscriber list for the channel detail page (Phase 5.3).
//
// Pure presentational: renders one row per subscriber with avatar +
// name + email, plus a per-row trash button when the viewer is
// allowed to remove that subscriber. Sorted alphabetically by full
// name (with unknown ids — not yet hydrated — pushed to the end).
//
// Permissions:
//   - admins can remove any subscriber;
//   - any viewer can remove themselves (the row's trash button shows
//     for the viewer's own row regardless of admin-ness, mirroring
//     the channel "leave" affordance).

import { useMemo } from "react";
import { Avatar } from "../../../components/Avatar";
import { IconButton } from "../../../components/IconButton";
import { Spinner } from "../../../components/Spinner";
import type { User, UserId } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./SubscriberList.module.css";

export interface SubscriberListProps {
  /**
   * Subscriber user ids; `undefined` = still loading. The streams-store
   * gives a live array for subscribed channels; for non-subscribed
   * channels the parent fetches it once via REST.
   */
  subscribers: UserId[] | undefined;
  /** Admins can remove anyone. */
  canRemoveOthers: boolean;
  /** The viewer's own user id; can always remove self when present. */
  ownUserId: UserId | undefined;
  onRequestRemove: (userId: UserId) => void;
}

interface Resolved {
  userId: UserId;
  user: User | undefined;
}

export function SubscriberList({
  subscribers,
  canRemoveOthers,
  ownUserId,
  onRequestRemove,
}: SubscriberListProps): React.JSX.Element {
  const usersMap = useUsersStore((s) => s.users);

  const rows = useMemo<Resolved[]>(() => {
    if (subscribers === undefined) {
      return [];
    }
    const resolved = subscribers.map((id) => ({ userId: id, user: usersMap[id] }));
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
  }, [subscribers, usersMap]);

  if (subscribers === undefined) {
    return (
      <div className={styles.loading}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className={styles.empty}>Подписчиков пока нет.</p>;
  }

  return (
    <ul className={styles.list} aria-label="Подписчики">
      {rows.map(({ userId, user }) => {
        const isSelf = ownUserId === userId;
        const showRemove = canRemoveOthers || isSelf;
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
            {showRemove && (
              <IconButton
                icon="trash"
                aria-label={
                  isSelf
                    ? "Покинуть канал"
                    : `Убрать ${displayName} из канала`
                }
                variant="ghost"
                size="sm"
                onClick={() => onRequestRemove(userId)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

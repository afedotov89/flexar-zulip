// Flexar Hub Web — admin user deactivation confirmation (Phase 5.4).
//
// Wraps `apiClient.deactivateUser` behind an explicit confirmation
// with an optional notification comment surfaced to the affected user.
// Optimistically marks the directory entry as inactive so the row
// disappears from the "Активные" tab immediately; restores the
// original entry on REST failure.

import { useCallback, useState } from "react";
import { apiClient } from "../../../api";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { Modal } from "../../../components/Modal";
import type { User } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./DeactivateUserModal.module.css";

export interface DeactivateUserModalProps {
  /** Whether the modal is open. Controlled. */
  open: boolean;
  /** The user being deactivated. */
  user: User;
  /** Called when the modal is dismissed (success, cancel, backdrop). */
  onClose: () => void;
}

export function DeactivateUserModal({
  open,
  user,
  onClose,
}: DeactivateUserModalProps): React.JSX.Element {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isDeactivating) {
      return;
    }
    const snapshot = useUsersStore.getState().users[user.user_id];
    if (snapshot === undefined) {
      setError("Пользователь больше не доступен.");
      return;
    }
    const trimmedComment = comment.trim();
    setIsDeactivating(true);
    setError(null);
    // Optimistic: flip is_active so the row leaves the active tab.
    useUsersStore.setState((state) => ({
      users: {
        ...state.users,
        [user.user_id]: { ...snapshot, is_active: false },
      },
    }));
    try {
      await apiClient.deactivateUser(user.user_id, {
        deactivationNotificationComment:
          trimmedComment === "" ? undefined : trimmedComment,
      });
      setIsDeactivating(false);
      onClose();
    } catch (cause) {
      useUsersStore.setState((state) => ({
        users: { ...state.users, [user.user_id]: snapshot },
      }));
      setError(describeApiError(cause, "Не удалось деактивировать пользователя."));
      setIsDeactivating(false);
    }
  }, [comment, isDeactivating, onClose, user.user_id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Деактивировать пользователя?"
      size="sm"
      dismissable={!isDeactivating}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDeactivating}
          >
            Отмена
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={isDeactivating}
          >
            Деактивировать
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <p className={styles.text}>
          Деактивировать {user.full_name}? Пользователь не сможет войти, пока
          его не восстановят.
        </p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="deactivate-user-comment">
            Комментарий для уведомления (необязательно)
          </label>
          <Input
            id="deactivate-user-comment"
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            disabled={isDeactivating}
            maxLength={200}
            placeholder="Например: учётная запись больше не используется"
          />
        </div>
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

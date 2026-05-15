// Flexar Hub Web — admin user reactivation confirmation (Phase 5.4).
//
// Wraps `apiClient.reactivateUser` behind an explicit confirmation.
// Optimistically marks the directory entry as active so the row moves
// from "Деактивированные" back to "Активные"; restores on REST failure.

import { useCallback, useState } from "react";
import { apiClient } from "../../../api";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import type { User } from "../../../domain";
import { describeApiError } from "../../../lib/errors";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./ReactivateConfirmModal.module.css";

export interface ReactivateConfirmModalProps {
  /** Whether the modal is open. Controlled. */
  open: boolean;
  /** The user being reactivated. */
  user: User;
  /** Called when the modal is dismissed (success, cancel, backdrop). */
  onClose: () => void;
}

export function ReactivateConfirmModal({
  open,
  user,
  onClose,
}: ReactivateConfirmModalProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isReactivating) {
      return;
    }
    const snapshot = useUsersStore.getState().users[user.user_id];
    if (snapshot === undefined) {
      setError("Пользователь больше не доступен.");
      return;
    }
    setIsReactivating(true);
    setError(null);
    useUsersStore.setState((state) => ({
      users: {
        ...state.users,
        [user.user_id]: { ...snapshot, is_active: true },
      },
    }));
    try {
      await apiClient.reactivateUser(user.user_id);
      setIsReactivating(false);
      onClose();
    } catch (cause) {
      useUsersStore.setState((state) => ({
        users: { ...state.users, [user.user_id]: snapshot },
      }));
      setError(describeApiError(cause, "Не удалось восстановить пользователя."));
      setIsReactivating(false);
    }
  }, [isReactivating, onClose, user.user_id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Восстановить пользователя?"
      size="sm"
      dismissable={!isReactivating}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isReactivating}
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={isReactivating}
          >
            Восстановить
          </Button>
        </>
      }
    >
      <p className={styles.text}>
        Восстановить {user.full_name}? Пользователь снова сможет войти.
      </p>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

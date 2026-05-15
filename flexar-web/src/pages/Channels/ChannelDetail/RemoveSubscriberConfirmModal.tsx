// Confirm modal for removing a subscriber (Phase 5.3).
//
// The destructive call (`apiClient.unsubscribe` with a `principals`
// override) is gated behind an explicit confirmation. The actual REST
// call lives in the parent so it can clear `removeTarget` and surface
// the error in a single banner — this modal only owns the UX.

import { useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import type { UserId } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./RemoveSubscriberConfirmModal.module.css";

export interface RemoveSubscriberConfirmModalProps {
  open: boolean;
  userId: UserId;
  /** True when the viewer is removing themselves. */
  isSelf: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemoveSubscriberConfirmModal({
  open,
  userId,
  isSelf,
  onClose,
  onConfirm,
}: RemoveSubscriberConfirmModalProps): React.JSX.Element {
  const user = useUsersStore((s) => s.users[userId]);
  const [busy, setBusy] = useState(false);

  const displayName = user?.full_name ?? `Пользователь #${userId}`;
  const title = isSelf ? "Покинуть канал?" : "Убрать подписчика?";
  const body = isSelf
    ? "Вы перестанете получать новые сообщения этого канала. Подписаться обратно можно в любой момент."
    : `«${displayName}» больше не сможет читать новые сообщения и не получит уведомлений из этого канала.`;
  const confirmLabel = isSelf ? "Покинуть" : "Убрать";

  const handleConfirm = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissable={!busy}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.body}>{body}</p>
    </Modal>
  );
}

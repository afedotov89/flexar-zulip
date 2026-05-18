// Confirm modal for removing a member from a user group (Phase C2).
//
// Mirrors `pages/Channels/ChannelDetail/RemoveSubscriberConfirmModal`
// — the destructive `apiClient.removeUserGroupMembers` call is gated
// behind an explicit confirmation. The actual REST call lives in the
// parent (`MembersTab`) so it can surface errors in a single banner;
// this modal only owns the UX.

import { useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import type { UserId } from "../../../domain";
import { useUsersStore } from "../../../stores/usersStore";
import styles from "./RemoveMemberConfirmModal.module.css";

export interface RemoveMemberConfirmModalProps {
  open: boolean;
  userId: UserId;
  groupName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemoveMemberConfirmModal({
  open,
  userId,
  groupName,
  onClose,
  onConfirm,
}: RemoveMemberConfirmModalProps): React.JSX.Element {
  const user = useUsersStore((s) => s.users[userId]);
  const [busy, setBusy] = useState(false);

  const displayName = user?.full_name ?? `Пользователь #${userId}`;

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
      title="Удалить участника?"
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
            Удалить
          </Button>
        </>
      }
    >
      <p className={styles.body}>
        Убрать «{displayName}» из группы «{groupName}»?
      </p>
    </Modal>
  );
}

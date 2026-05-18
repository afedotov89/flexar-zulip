// Confirm modal for deactivating a user group (Phase C5).
//
// Owns the API call itself (unlike the Remove*ConfirmModal pair in
// C2/C3, where the parent owned the call). Reason: the Danger zone
// has nothing else to do after a successful deactivation — the
// realtime echo flips `deactivated: true` in the store, the page
// re-renders with the Overview banner, and this modal unmounts. The
// only reactive surface is the error path, and it belongs inside the
// modal so the user sees the failure right where they triggered it.

import { useState } from "react";
import { apiClient } from "../../../api";
import { Banner } from "../../../components/Banner";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import { describeApiError } from "../../../lib/errors";
import styles from "./DeactivateGroupConfirmModal.module.css";

export interface DeactivateGroupConfirmModalProps {
  open: boolean;
  groupId: number;
  /** Display name shown in the modal body. */
  groupName: string;
  onClose: () => void;
}

export function DeactivateGroupConfirmModal({
  open,
  groupId,
  groupName,
  onClose,
}: DeactivateGroupConfirmModalProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.deactivateUserGroup(groupId);
      // Success: realtime `user_group:update` will flip the group's
      // `deactivated` flag in the store; the parent re-renders into
      // the read-only state and unmounts this modal.
      onClose();
    } catch (cause) {
      setError(describeApiError(cause, "Не удалось деактивировать группу."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Деактивировать группу?"
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
            Деактивировать
          </Button>
        </>
      }
    >
      {error !== null && (
        <Banner tone="danger" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      <p className={styles.body}>
        Группа «{groupName}» будет деактивирована. Реактивировать можно
        позже.
      </p>
    </Modal>
  );
}

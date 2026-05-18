// Confirm modal for removing a subgroup from a user group (Phase C3).
//
// Mirrors `RemoveMemberConfirmModal` — gates the destructive
// `apiClient.removeUserGroupSubgroups` call behind an explicit
// confirmation. The REST call lives in the parent (`SubgroupsTab`).

import { useState } from "react";
import { Button } from "../../../components/Button";
import { Modal } from "../../../components/Modal";
import styles from "./RemoveSubgroupConfirmModal.module.css";

export interface RemoveSubgroupConfirmModalProps {
  open: boolean;
  /** Display label of the subgroup being removed (or "(удалена)"). */
  subgroupName: string;
  /** Display label of the parent group the subgroup is being removed from. */
  parentName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemoveSubgroupConfirmModal({
  open,
  subgroupName,
  parentName,
  onClose,
  onConfirm,
}: RemoveSubgroupConfirmModalProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);

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
      title="Убрать подгруппу?"
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
            Убрать
          </Button>
        </>
      }
    >
      <p className={styles.body}>
        Убрать подгруппу «{subgroupName}» из «{parentName}»?
      </p>
    </Modal>
  );
}

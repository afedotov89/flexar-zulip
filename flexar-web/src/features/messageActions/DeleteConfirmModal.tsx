// Flexar Hub Web — message delete confirmation (Phase 3.3).
//
// A small `Modal` wrapper that gates the destructive
// `apiClient.deleteMessage` call behind an explicit user confirmation.
// Optimistically removes the message from the cache on confirm; on
// REST failure restores the snapshotted body and flags and surfaces
// the error in the modal so the user can retry or cancel.
//
// The modal stays mounted across the in-flight delete so the spinner
// is visible — closing only happens on success or explicit cancel.

import { useCallback, useState } from "react";
import { apiClient, isApiError } from "../../api";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import type { Message } from "../../domain";
import { useMessagesStore } from "../../stores/messagesStore";
import styles from "./DeleteConfirmModal.module.css";

export interface DeleteConfirmModalProps {
  /** Whether the modal is open. Controlled. */
  open: boolean;
  /** The message that would be deleted. */
  message: Message;
  /** Called when the modal is dismissed (success, cancel, backdrop). */
  onClose: () => void;
}

function describeError(error: unknown): string {
  if (isApiError(error)) {
    return error.body?.msg ?? error.message;
  }
  return error instanceof Error ? error.message : "Could not delete message.";
}

export function DeleteConfirmModal({
  open,
  message,
  onClose,
}: DeleteConfirmModalProps): React.JSX.Element {
  const applyOptimisticDelete = useMessagesStore(
    (s) => s.applyOptimisticDelete,
  );
  const restoreMessage = useMessagesStore((s) => s.restoreMessage);
  const restoreFlags = useMessagesStore((s) => s.restoreFlags);
  const getFlags = useMessagesStore((s) => s.getFlags);

  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isDeleting) {
      return;
    }
    // Snapshot before the optimistic write so we can restore on failure.
    const snapshotMessage = message;
    const snapshotFlags = getFlags(message.id);
    setIsDeleting(true);
    setError(null);
    applyOptimisticDelete({ message_id: message.id });
    try {
      await apiClient.deleteMessage(message.id);
      // Success: close. The realtime `delete_message` event will
      // arrive shortly after and is idempotent on an already-deleted id.
      setIsDeleting(false);
      onClose();
    } catch (cause) {
      restoreMessage(snapshotMessage);
      if (snapshotFlags.length > 0) {
        restoreFlags(snapshotMessage.id, snapshotFlags);
      }
      setError(describeError(cause));
      setIsDeleting(false);
    }
  }, [
    applyOptimisticDelete,
    getFlags,
    isDeleting,
    message,
    onClose,
    restoreFlags,
    restoreMessage,
  ]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete message?"
      size="sm"
      // Disallow accidental dismissal while the request is in flight —
      // the user should see the result, not lose the modal mid-call.
      dismissable={!isDeleting}
      footer={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={() => {
              void handleConfirm();
            }}
            loading={isDeleting}
          >
            Delete
          </Button>
        </>
      }
    >
      <p className={styles.body}>This action can&rsquo;t be undone.</p>
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
